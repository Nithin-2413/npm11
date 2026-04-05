import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { StatusBadge, StatusType } from "@/components/StatusBadge";
import { ActionBadge, ActionType } from "@/components/ActionBadge";
import { LiquidProgress } from "@/components/LiquidProgress";
import { LiveBrowserPreview } from "@/components/LiveBrowserPreview";
import {
  Play, X, Brain, Wrench, AlertTriangle, Zap, ArrowRight,
  RefreshCw, BookOpen, CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import {
  executeCommand, executeBlueprint, cancelExecution, createExecutionWS,
  listBlueprints, Blueprint, ActionResult, NetworkRequest
} from "@/lib/api";
import { toast } from "sonner";

interface TerminalLine {
  type: "info" | "warn" | "error" | "success" | "system";
  text: string;
  time: string;
}

interface LiveNetReq {
  method: string;
  url: string;
  status: number;
  duration_ms: number;
  is_error: boolean;
}

interface AIDiagnosisData {
  root_cause: string;
  suggested_fix: string;
  confidence: number;
  full_analysis?: string;
  affected_component: string;
  error_type?: string;
  impact_level?: string;
  raw_error?: string;
}

const Execute = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [command, setCommand] = useState("");
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<StatusType>("pending");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [expandedAction, setExpandedAction] = useState<number | null>(null);
  const [consoleFilter, setConsoleFilter] = useState<string>("all");
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [showFix, setShowFix] = useState(false);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [showBpMenu, setShowBpMenu] = useState(false);

  // Real-time state
  const [actions, setActions] = useState<ActionResult[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLine[]>([]);
  const [networkLogs, setNetworkLogs] = useState<LiveNetReq[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIDiagnosisData | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [stealthMode, setStealthMode] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // FIX 1: All WebSocket/execution state in refs — survives re-renders
  // ──────────────────────────────────────────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null);          // NEVER useState for WS
  const isExecutingRef = useRef(false);                  // Navigation guard
  const wsConnectedRef = useRef(false);                  // Track WS connected state
  const wsReconnectCountRef = useRef(0);                 // Reconnect attempt counter
  const wsReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<number>(0);
  const terminalRef = useRef<HTMLDivElement>(null);
  const currentExecutionIdRef = useRef<string | null>(null);

  const BACKEND_URL = (import.meta.env.REACT_APP_BACKEND_URL as string || "").replace(/\/$/, "");

  // FIX ISSUE 2: Read command from location state (passed from Dashboard)
  useEffect(() => {
    const state = location.state as { command?: string } | null;
    if (state?.command) {
      setCommand(state.command);
      // Clear the location state to prevent re-populating on navigation
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Load blueprints for quick select
  useEffect(() => {
    listBlueprints({ page_size: 20 } as never).then(r => setBlueprints(r.blueprints)).catch(() => {});
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLogs]);

  // ──────────────────────────────────────────────────────────────────────────
  // beforeunload handler — warn user ONLY if trying to close/refresh page
  // NOT during normal execution (removed to prevent false warnings)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Disabled: This was causing "Changes may not be saved" popup during execution
    // If needed, can be re-enabled with better logic to detect actual navigation
    return () => {};
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // FIX 1: Cleanup all intervals/timers/WS on unmount
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearAllTimers();
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on unmount
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, []);

  const clearAllTimers = () => {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
    if (wsReconnectTimerRef.current) { clearTimeout(wsReconnectTimerRef.current); wsReconnectTimerRef.current = null; }
  };

  const addLog = useCallback((type: TerminalLine["type"], text: string) => {
    const el = startTime.current ? ((Date.now() - startTime.current) / 1000).toFixed(2) : "0.00";
    setTerminalLogs(prev => [...prev.slice(-200), { type, text, time: `${el}s` }]);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // FIX 1: Stop polling if WS is connected. Start polling only if WS fails
  // ──────────────────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((execId: string) => {
    // Only poll if WS is not connected
    if (wsConnectedRef.current) return;
    if (pollingIntervalRef.current) return; // already polling

    addLog("system", "WebSocket unavailable — falling back to polling");
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const { getExecutionStatus } = await import("@/lib/api");
        const statusData = await getExecutionStatus(execId);

        // If WS reconnected during polling, stop polling
        if (wsConnectedRef.current) {
          stopPolling();
          return;
        }

        if (statusData.status !== "RUNNING") {
          const s = statusData.status;
          setStatus(s === "SUCCESS" ? "success" : s === "FAILURE" ? "failure" : s === "PARTIAL" ? "partial" : "pending");
          setProgress(100);
          setIsRunning(false);
          isExecutingRef.current = false;
          clearAllTimers();
          toast[s === "SUCCESS" ? "success" : "error"](`Execution ${s.toLowerCase()}`);
        } else {
          const pct = statusData.actions_total > 0
            ? Math.round((statusData.actions_completed / statusData.actions_total) * 100)
            : 0;
          setProgress(pct);
        }
      } catch {}
    }, 3000);
  }, [addLog, stopPolling]);

  // ──────────────────────────────────────────────────────────────────────────
  // FIX 1: WebSocket with silent reconnect (no page reload, exponential backoff)
  // ──────────────────────────────────────────────────────────────────────────
  const connectWebSocket = useCallback((execId: string, isReconnect = false) => {
    // FIX 1: Close existing WS cleanly without triggering reconnect loop
    if (wsRef.current) {
      wsRef.current.onclose = null; // Detach handler before closing
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (!isReconnect) {
      wsReconnectCountRef.current = 0;
    }

    const ws = createExecutionWS(execId);
    wsRef.current = ws;  // Store in ref, NOT state

    ws.onopen = () => {
      wsConnectedRef.current = true;
      wsReconnectCountRef.current = 0; // Reset on successful connection
      // FIX 1: Stop polling when WS connects
      stopPolling();
      if (isReconnect) {
        addLog("system", "WebSocket reconnected successfully");
      } else {
        addLog("system", "WebSocket connected — live stream active");
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        handleWsMessage(msg);
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    ws.onerror = () => {
      // FIX 1: Log error but DO NOT reload page or reset state
      wsConnectedRef.current = false;
      addLog("warn", "WebSocket connection error");
    };

    ws.onclose = () => {
      wsConnectedRef.current = false;

      // FIX 1: Only reconnect if execution is still running
      if (!isExecutingRef.current) {
        addLog("system", "WebSocket closed (execution complete)");
        return;
      }

      const maxRetries = 5;
      const attempt = wsReconnectCountRef.current;

      if (attempt >= maxRetries) {
        addLog("warn", `WebSocket reconnect failed after ${maxRetries} attempts — switching to polling`);
        startPolling(execId);
        return;
      }

      // FIX 1: Exponential backoff reconnect — NO window.location.reload() EVER
      const delay = Math.min(1000 * Math.pow(1.5, attempt), 10000); // 1s, 1.5s, 2.25s, 3.4s, 5.1s
      wsReconnectCountRef.current += 1;
      addLog("system", `WebSocket disconnected — reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);

      wsReconnectTimerRef.current = setTimeout(() => {
        if (isExecutingRef.current) {
          connectWebSocket(execId, true);
        }
      }, delay);
    };
  }, [addLog, stopPolling, startPolling]); // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────────────────────────────────────────────────────────────
  // WebSocket message handler (extracted to avoid closure issues)
  // ──────────────────────────────────────────────────────────────────────────
  const handleWsMessage = useCallback((msg: Record<string, unknown>) => {
    if (msg.type === "connected") {
      addLog("system", `Execution ${msg.execution_id || currentExecutionIdRef.current} connected`);
    } else if (msg.type === "status") {
      addLog("info", msg.message as string);
    } else if (msg.type === "actions_parsed") {
      addLog("success", `✓ AI parsed ${msg.count} actions`);
    } else if (msg.type === "action_start") {
      const { index, total, action, url, selector, value, description, confidence } = msg as Record<string, unknown>;
      const pct = (total as number) > 0 ? Math.round(((index as number) / (total as number)) * 100) : 0;
      setProgress(pct);
      const target = (url || selector || value || "") as string;
      const desc = (description as string) || `${action} ${target}`;
      const conf = confidence ? ` (${Math.round((confidence as number) * 100)}%)` : "";
      addLog("info", `▶ Step ${(index as number) + 1}/${total}: ${desc}${conf}`);
    } else if (msg.type === "action_complete") {
      const { index, total, status: s, duration_ms, screenshot_url, error, used_fallback, was_refined } = msg as Record<string, unknown>;
      const pct = (total as number) > 0 ? Math.round((((index as number) + 1) / (total as number)) * 100) : 100;
      setProgress(pct);
      if (s === "success") {
        const extras = [used_fallback ? "✦ fallback" : null, was_refined ? "✧ AI-refined" : null].filter(Boolean).join(", ");
        addLog("success", `✓ Step ${(index as number) + 1} done (${duration_ms}ms)${extras ? ` [${extras}]` : ""}`);
      } else {
        addLog("error", `✗ Step ${(index as number) + 1} failed: ${error || "unknown"}`);
      }
      if (screenshot_url) {
        setLatestScreenshot(`${BACKEND_URL}${screenshot_url}`);
      }
      setActions(prev => {
        const updated = [...prev];
        const existing = updated.findIndex(a => a.action_index === (index as number));
        if (existing >= 0) {
          updated[existing] = {
            ...updated[existing],
            status: s as "success" | "failure" | "skipped",
            duration_ms: duration_ms as number,
            screenshot_path: screenshot_url as string | undefined,
          };
        } else {
          updated.push({
            action_index: index as number,
            action_type: "action",
            status: s as "success" | "failure" | "skipped",
            started_at: new Date().toISOString(),
            duration_ms: duration_ms as number,
            screenshot_path: screenshot_url as string | undefined,
          });
        }
        return updated;
      });
    } else if (msg.type === "network_request") {
      setNetworkLogs(prev => [...prev.slice(-50), {
        method: msg.method as string,
        url: msg.url as string,
        status: msg.status as number,
        duration_ms: msg.duration_ms as number,
        is_error: msg.is_error as boolean,
      }]);
      if (msg.is_error) addLog("warn", `⚠ ${msg.method} ${(msg.url as string).slice(0, 80)} → ${msg.status}`);
    } else if (msg.type === "console_log") {
      const t = msg.log_type as TerminalLine["type"];
      addLog(["warn", "error"].includes(t) ? t : "info", `[console.${msg.log_type}] ${msg.text}`);
    } else if (msg.type === "error") {
      addLog("error", `✗ ${msg.error_message}`);
      // FIX 2: Set AI analysis from WebSocket error event
      if (msg.ai_analysis) {
        setAiAnalysis(msg.ai_analysis as AIDiagnosisData);
      }
    } else if (msg.type === "execution_complete") {
      const s = msg.status as string;
      setStatus(s === "SUCCESS" ? "success" : s === "FAILURE" ? "failure" : s === "PARTIAL" ? "partial" : "pending");
      setProgress(s === "SUCCESS" ? 100 : progress);
      if (msg.ai_summary) setAiSummary(msg.ai_summary as string);
      // FIX 2: Also capture ai_analysis from execution_complete event
      if (msg.ai_analysis) {
        setAiAnalysis(msg.ai_analysis as AIDiagnosisData);
      }
      addLog(
        s === "SUCCESS" ? "success" : "error",
        `━━ Execution ${s} — ${msg.actions_successful}/${msg.actions_total} actions, ${(msg.duration_seconds as number)?.toFixed(1)}s`
      );
      setIsRunning(false);
      isExecutingRef.current = false; // FIX 1: Update ref before timers
      clearAllTimers();
      toast[s === "SUCCESS" ? "success" : "error"](`Execution ${s.toLowerCase()}`);
    }
  }, [addLog, BACKEND_URL, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = async () => {
    if (!command.trim() || isRunning) return;

    // Reset state
    setActions([]);
    setTerminalLogs([]);
    setNetworkLogs([]);
    setAiAnalysis(null);
    setAiSummary(null);
    setLatestScreenshot(null);
    setProgress(0);
    setElapsed(0);
    setStatus("running");
    setIsRunning(true);
    isExecutingRef.current = true; // FIX 1: Mark as executing
    startTime.current = Date.now();

    elapsedRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime.current) / 100) / 10);
    }, 100);

    try {
      addLog("system", `Starting: ${command}`);
      const res = await executeCommand(command, { headless: true, stealth_mode: stealthMode });
      setExecutionId(res.execution_id);
      currentExecutionIdRef.current = res.execution_id;
      addLog("info", `Execution ID: ${res.execution_id}`);
      connectWebSocket(res.execution_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("error", `Failed to start: ${msg}`);
      setIsRunning(false);
      isExecutingRef.current = false;
      setStatus("failure");
      toast.error("Failed to start execution");
      clearAllTimers();
    }
  };

  const handleCancel = async () => {
    if (executionId) {
      try { await cancelExecution(executionId); } catch {}
    }
    // FIX 1: Close WS cleanly without triggering reconnect
    if (wsRef.current) {
      isExecutingRef.current = false; // Must set BEFORE closing WS
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    clearAllTimers();
    setIsRunning(false);
    isExecutingRef.current = false;
    setStatus("partial");
    addLog("warn", "Execution cancelled by user");
    toast.info("Execution cancelled");
  };

  const handleBlueprintSelect = async (bp: Blueprint) => {
    setShowBpMenu(false);
    if (isRunning) return;

    setActions([]);
    setTerminalLogs([]);
    setNetworkLogs([]);
    setAiAnalysis(null);
    setAiSummary(null);
    setLatestScreenshot(null);
    setProgress(0);
    setElapsed(0);
    setStatus("running");
    setIsRunning(true);
    isExecutingRef.current = true;
    startTime.current = Date.now();

    elapsedRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime.current) / 100) / 10);
    }, 100);

    try {
      addLog("system", `Running blueprint: ${bp.name}`);
      const res = await executeBlueprint(bp.blueprint_id, {});
      setExecutionId(res.execution_id);
      currentExecutionIdRef.current = res.execution_id;
      addLog("info", `Execution ID: ${res.execution_id}`);
      connectWebSocket(res.execution_id);
      setCommand(`Run blueprint: ${bp.name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("error", `Failed: ${msg}`);
      setIsRunning(false);
      isExecutingRef.current = false;
      setStatus("failure");
      clearAllTimers();
    }
  };

  const filteredLogs = consoleFilter === "all" ? terminalLogs : terminalLogs.filter(l => l.type === consoleFilter);
  const networkErrors = networkLogs.filter(r => r.is_error).length;
  const successCount = actions.filter(a => a.status === "success").length;
  const failCount = actions.filter(a => a.status === "failure").length;
  const totalActions = actions.length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Command & Controls */}
      <GlassPanel glow="cyan" delay={0}>
        <div className="space-y-4">
          <div>
            <div className="font-mono text-xs text-muted-foreground mb-1">Natural Language Command:</div>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              rows={2}
              disabled={isRunning}
              className="w-full font-mono text-sm text-foreground/60 bg-muted/10 rounded-lg px-3 py-2 border border-glass-border/60 outline-none focus:ring-1 focus:ring-primary/40 resize-none placeholder:text-muted-foreground/40 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Go to amazon.com, search for wireless mouse, click first result, add to cart"
            />
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <AnimatePresence mode="wait">
              {!isRunning ? (
                <motion.button
                  key="run"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={handleRun}
                  disabled={!command.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-xs font-semibold text-primary border border-primary/30 hover:border-primary/50 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "hsl(var(--glass-bg) / 0.25)",
                    backdropFilter: "blur(24px) saturate(1.4)",
                    boxShadow: "inset 0 1px 0 0 hsl(0 0% 100% / 0.08), 0 2px 8px -2px hsl(0 0% 0% / 0.15)",
                  }}
                >
                  <Play className="w-3.5 h-3.5" /> Run
                </motion.button>
              ) : (
                <motion.div key="controls" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs border border-primary/20 text-primary/60">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Running... {wsConnectedRef.current ? "🔗" : "📡"}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Blueprint selector */}
            <div className="relative">
              <button
                onClick={() => setShowBpMenu(!showBpMenu)}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <BookOpen className="w-3.5 h-3.5" /> Use Blueprint
              </button>
              <AnimatePresence>
                {showBpMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full mt-2 left-0 w-56 rounded-xl border border-glass-border p-1 z-50 shadow-2xl"
                    style={{ background: "hsl(var(--popover))", backdropFilter: "blur(40px)" }}
                  >
                    {blueprints.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground font-mono">No blueprints found</div>
                    )}
                    {blueprints.map(bp => (
                      <button
                        key={bp.blueprint_id}
                        onClick={() => handleBlueprintSelect(bp)}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono hover:bg-primary/10 text-foreground/80 hover:text-primary transition-colors"
                      >
                        {bp.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Stealth Mode Toggle */}
            <button
              onClick={() => setStealthMode(!stealthMode)}
              disabled={isRunning}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                stealthMode
                  ? "border-emerald-400/40 text-emerald-400 bg-emerald-400/10"
                  : "border-glass-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
              title="Enable stealth mode to avoid bot detection"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              Stealth {stealthMode ? "ON" : "OFF"}
            </button>
          </div>
          {aiSummary && !isRunning && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 font-mono text-[11px] text-muted-foreground">
              <span className="text-primary">AI Summary: </span>{aiSummary}
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Status Banner */}
      {(isRunning || totalActions > 0) && (
        <div className="glass-panel glass-glow-cyan p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <StatusBadge status={status} size="lg" />
            <div>
              <div className="font-mono text-2xl font-bold text-primary">{progress}%</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {successCount} success · {failCount} failed · {networkLogs.length} requests
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-foreground">{elapsed}s</div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase">Elapsed</div>
            </div>
            {executionId && (
              <div className="text-center">
                <div className="font-mono text-[10px] font-bold text-muted-foreground truncate max-w-[120px]">{executionId}</div>
                <div className="font-mono text-[9px] text-muted-foreground uppercase">Exec ID</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {(isRunning || totalActions > 0) && (
        <LiquidProgress value={progress} label={isRunning ? "Running automation..." : `Completed: ${successCount}/${totalActions} actions`} />
      )}

      {/* Live View */}
      {(isRunning || terminalLogs.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-6">
          <GlassPanel title="Live Terminal" icon="🖥️" glow="cyan" delay={0.1}>
            <LiveTerminal logs={filteredLogs} filter={consoleFilter} onFilterChange={setConsoleFilter} terminalRef={terminalRef} />
          </GlassPanel>
          <GlassPanel title="Live Browser" icon="🌐" glow="purple" delay={0.15}>
            <LiveBrowserPreview screenshotUrl={latestScreenshot} isRunning={isRunning} />
          </GlassPanel>
        </div>
      )}

      {/* Action Timeline + Network + AI Diagnosis */}
      {(totalActions > 0 || networkLogs.length > 0 || aiAnalysis) && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Action Timeline */}
          <GlassPanel title="Action Timeline" icon="📋" glow="cyan" delay={0.2}>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {actions.length === 0 && isRunning && (
                <div className="text-xs text-muted-foreground font-mono py-4 text-center">Waiting for actions...</div>
              )}
              {actions.map((action, i) => (
                <div key={i}>
                  <div
                    onClick={() => setExpandedAction(expandedAction === i ? null : i)}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-xs font-mono overflow-hidden ${
                      action.status === "success" ? "hover:bg-muted/10" :
                      action.status === "failure" ? "bg-destructive/5 border border-destructive/20" :
                      "opacity-50"
                    } ${expandedAction === i ? "ring-1 ring-primary/20" : ""}`}
                  >
                    <StatusBadge status={action.status as StatusType} className="border-0 bg-transparent px-0 gap-0 shrink-0" />
                    <ActionBadge type={action.action_type as ActionType} />
                    <span className="truncate text-foreground/70 flex-1 min-w-0">{action.selector || action.value || action.action_type}</span>
                    <span className="text-muted-foreground text-[10px] shrink-0">{action.duration_ms}ms</span>
                  </div>
                  <AnimatePresence>
                    {expandedAction === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="ml-6 my-1 px-3 py-2 rounded-lg border border-glass-border bg-muted/10 font-mono text-[11px] text-muted-foreground">
                          {action.error_message && <p className="text-destructive">{action.error_message}</p>}
                          {action.screenshot_path && (
                            <a href={`${BACKEND_URL}${action.screenshot_path}`} target="_blank" rel="noreferrer" className="text-primary/60 underline">View screenshot</a>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Network Monitor */}
          <GlassPanel title="Network Monitor" icon="🔮" glow="cyan" delay={0.3}>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-xs text-primary">{networkLogs.length} requests</span>
              <span className="font-mono text-xs text-destructive">{networkErrors} error{networkErrors !== 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {networkLogs.length === 0 && (
                <div className="text-xs text-muted-foreground font-mono py-4 text-center">No requests captured</div>
              )}
              {networkLogs.map((req, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/10 transition-colors font-mono text-[11px] overflow-hidden">
                  <span className={`font-semibold w-10 shrink-0 ${req.method === "POST" ? "text-secondary" : "text-primary"}`}>{req.method}</span>
                  <span className="truncate flex-1 min-w-0 text-foreground/70">{req.url.replace(/^https?:\/\/[^/]+/, "")}</span>
                  <span className={`shrink-0 ${req.status >= 400 ? "text-destructive" : "text-emerald-400"}`}>{req.status}</span>
                  <span className="text-muted-foreground w-14 text-right shrink-0">{req.duration_ms}ms</span>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* FIX 2: AI Diagnosis — shows errors with full details */}
          <GlassPanel title="AI Diagnosis" icon="🧠" glow="pink" delay={0.35}>
            <AIDiagnosisPanel
              aiAnalysis={aiAnalysis}
              isRunning={isRunning}
              executionStatus={status}
              onShowFull={() => setShowDiagnosis(true)}
              onShowFix={() => setShowFix(true)}
            />
          </GlassPanel>
        </div>
      )}

      {/* Empty state */}
      {!isRunning && totalActions === 0 && terminalLogs.length === 0 && (
        <GlassPanel glow="cyan" delay={0.2}>
          <div className="text-center py-12 space-y-4">
            <div className="text-5xl">🤖</div>
            <h2 className="font-mono text-xl font-bold text-foreground">Ready to Execute</h2>
            <p className="font-mono text-sm text-muted-foreground max-w-md mx-auto">
              Enter a natural language command above to start AI-powered browser automation.
              Network requests, console logs, and AI analysis will appear here in real-time.
            </p>
            <div className="text-left max-w-md mx-auto space-y-1">
              {[
                "Go to amazon.com, search for Moto Buds Plus, click first result, add to cart",
                "Go to google.com and search for OpenAI",
                "Go to example.com and take a screenshot",
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => setCommand(example)}
                  className="w-full text-left px-3 py-2 rounded-lg font-mono text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/5 border border-glass-border/40 hover:border-primary/20 transition-colors"
                >
                  → {example}
                </button>
              ))}
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Full Diagnosis Modal */}
      {createPortal(
        <AnimatePresence>
          {showDiagnosis && aiAnalysis && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDiagnosis(false)}
              className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm flex items-center justify-center"
            >
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()} className="w-[90vw] max-w-lg"
              >
                <div className="glass-panel p-5 space-y-4 border border-primary/20 rounded-2xl shadow-2xl"
                  style={{ background: "hsl(var(--glass-bg) / 0.85)", backdropFilter: "blur(40px) saturate(1.8)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      <span className="font-mono text-sm font-bold text-foreground">Full AI Diagnosis</span>
                    </div>
                    <button onClick={() => setShowDiagnosis(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-3 font-mono text-[11px]">
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3 h-3 text-destructive" />
                        <span className="font-semibold text-destructive">Error Type: {aiAnalysis.error_type}</span>
                        {aiAnalysis.impact_level && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">{aiAnalysis.impact_level}</span>
                        )}
                      </div>
                      <p className="text-muted-foreground">Affected: {aiAnalysis.affected_component}</p>
                      {aiAnalysis.raw_error && (
                        <p className="text-muted-foreground/60 text-[10px] mt-1 font-mono break-all">{aiAnalysis.raw_error}</p>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                      <div className="flex items-center gap-1.5 mb-1"><Zap className="w-3 h-3 text-primary" /><span className="font-semibold text-primary">Root Cause Analysis</span></div>
                      <p className="text-muted-foreground">{aiAnalysis.full_analysis || aiAnalysis.root_cause}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/15">
                      <div className="flex items-center gap-1.5 mb-1"><ArrowRight className="w-3 h-3 text-emerald-400" /><span className="font-semibold text-emerald-400">Suggested Fix</span></div>
                      <p className="text-muted-foreground">{aiAnalysis.suggested_fix}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Fix Modal */}
      {createPortal(
        <AnimatePresence>
          {showFix && aiAnalysis && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFix(false)}
              className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm flex items-center justify-center"
            >
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()} className="w-[90vw] max-w-lg"
              >
                <div className="glass-panel p-5 space-y-4 border border-emerald-400/20 rounded-2xl shadow-2xl"
                  style={{ background: "hsl(var(--glass-bg) / 0.85)", backdropFilter: "blur(40px) saturate(1.8)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-sm font-bold text-foreground">AI Suggested Fix</span>
                    </div>
                    <button onClick={() => setShowFix(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-3 font-mono text-[11px]">
                    <div className="p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/15">
                      <span className="font-semibold text-emerald-400">Proposed Fix</span>
                      <p className="text-muted-foreground mt-1">{aiAnalysis.suggested_fix}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                      <span className="font-semibold text-primary">AI Confidence</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.round((aiAnalysis.confidence || 0) * 100)}%` }} />
                        </div>
                        <span className="text-emerald-400 font-bold">{Math.round((aiAnalysis.confidence || 0) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowFix(false); setCommand(aiAnalysis.suggested_fix); }}
                    className="w-full font-mono text-[10px] px-3 py-2 rounded-lg bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/20 transition-colors"
                  >
                    Use Suggested Command
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: AI Diagnosis Panel Component — always shows something meaningful
// ─────────────────────────────────────────────────────────────────────────────
const AIDiagnosisPanel = ({
  aiAnalysis,
  isRunning,
  executionStatus,
  onShowFull,
  onShowFix,
}: {
  aiAnalysis: AIDiagnosisData | null;
  isRunning: boolean;
  executionStatus: StatusType;
  onShowFull: () => void;
  onShowFix: () => void;
}) => {
  if (!aiAnalysis) {
    // FIX 2: Clear messages based on context instead of blank
    if (isRunning) {
      return (
        <div className="font-mono text-xs text-muted-foreground text-center py-8 space-y-2">
          <Brain className="w-8 h-8 text-primary/40 mx-auto animate-pulse" />
          <p>AI monitoring for errors...</p>
        </div>
      );
    }
    if (executionStatus === "failure" || executionStatus === "partial") {
      return (
        <div className="font-mono text-xs text-center py-8 space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-400/60 mx-auto" />
          <p className="text-amber-400/80">Error occurred but AI analysis is unavailable.</p>
          <p className="text-muted-foreground text-[10px]">Check network logs for details.</p>
        </div>
      );
    }
    return (
      <div className="font-mono text-xs text-center py-8 space-y-2">
        <CheckCircle className="w-8 h-8 text-emerald-400/60 mx-auto" />
        <p className="text-emerald-400/80">No errors detected during this execution</p>
      </div>
    );
  }

  const impactColor = {
    Critical: "text-destructive",
    High: "text-orange-400",
    Medium: "text-amber-400",
    Low: "text-emerald-400",
  }[aiAnalysis.impact_level || "High"] || "text-amber-400";

  return (
    <div className="glass-panel-strong p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-foreground">{aiAnalysis.error_type || "Error Detected"}</span>
        <div className="flex items-center gap-1.5">
          {aiAnalysis.impact_level && (
            <span className={`font-mono text-[10px] font-bold ${impactColor}`}>{aiAnalysis.impact_level}</span>
          )}
          <span className="font-mono text-[10px] font-bold text-destructive">AI Analyzed</span>
        </div>
      </div>
      <div className="font-mono text-[11px] text-muted-foreground space-y-1">
        <p><span className="text-secondary">Component:</span> {aiAnalysis.affected_component}</p>
        <p><span className="text-primary">🎯 Root Cause:</span> {aiAnalysis.root_cause}</p>
        <p><span className="text-emerald-400">💡 Fix:</span> {aiAnalysis.suggested_fix}</p>
        {aiAnalysis.raw_error && (
          <p className="text-[10px] text-muted-foreground/50 truncate">
            <span className="text-muted-foreground">Error:</span> {aiAnalysis.raw_error.slice(0, 80)}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full bg-muted/20 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(aiAnalysis.confidence || 0) * 100}%` }} />
          </div>
          <span className="text-[10px] text-emerald-400">{Math.round((aiAnalysis.confidence || 0) * 100)}%</span>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onShowFull}
          className="font-mono text-[10px] px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
        >
          <Brain className="w-3 h-3" /> Full Diagnosis
        </button>
        <button
          onClick={onShowFix}
          className="font-mono text-[10px] px-3 py-1.5 rounded-lg border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10 transition-colors flex items-center gap-1"
        >
          <Wrench className="w-3 h-3" /> Suggested Fix
        </button>
      </div>
    </div>
  );
};

// Live terminal component
const LiveTerminal = ({
  logs, filter, onFilterChange, terminalRef
}: {
  logs: TerminalLine[];
  filter: string;
  onFilterChange: (f: string) => void;
  terminalRef: React.RefObject<HTMLDivElement>;
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 flex-wrap">
      {(["all", "info", "warn", "error", "success"] as const).map(f => (
        <button key={f} onClick={() => onFilterChange(f)}
          className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-colors ${
            filter === f ? "border-primary/40 text-primary bg-primary/10" : "border-glass-border text-muted-foreground hover:text-foreground"
          }`}
        >{f}</button>
      ))}
    </div>
    <div ref={terminalRef} className="glass-panel-strong p-3 font-mono text-xs max-h-[300px] overflow-y-auto rounded-lg">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-glass-border">
        <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-muted-foreground text-[10px]">npm://live-terminal</span>
      </div>
      {logs.length === 0 && <div className="text-muted-foreground/40 text-[10px]">Waiting for execution output...</div>}
      {logs.map((log, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 py-0.5">
          <span className="text-muted-foreground shrink-0">[{log.time}]</span>
          <span className={
            log.type === "error" ? "text-destructive" :
            log.type === "warn" ? "text-amber-400" :
            log.type === "success" ? "text-emerald-400" :
            log.type === "system" ? "text-muted-foreground" :
            "text-primary"
          }>{log.text}</span>
        </motion.div>
      ))}
      <span className="inline-block w-2 h-4 bg-primary animate-terminal-blink ml-1" />
    </div>
  </div>
);

export default Execute;
