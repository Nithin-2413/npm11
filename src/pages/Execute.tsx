import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/GlassPanel";
import { StatusBadge, StatusType } from "@/components/StatusBadge";
import { ActionBadge, ActionType } from "@/components/ActionBadge";
import { LiquidProgress } from "@/components/LiquidProgress";
import { LiveBrowserPreview } from "@/components/LiveBrowserPreview";
import { Play, Pause, X, Camera, ChevronDown, Brain, Wrench, AlertTriangle, Zap, ArrowRight } from "lucide-react";

interface ExecutionAction {
  type: ActionType;
  target: string;
  value?: string;
  status: StatusType;
  duration: string;
  details?: string;
}

const MOCK_ACTIONS: ExecutionAction[] = [
  { type: "navigate", target: "https://app.example.com/signup", status: "success", duration: "1.2s", details: "Page loaded. DOM snapshot captured (3.2KB)." },
  { type: "fill", target: "input#email", value: "test@example.com", status: "success", duration: "0.3s", details: "Input validated client-side. No errors." },
  { type: "fill", target: "input#password", value: "••••••••", status: "success", duration: "0.2s", details: "Password strength: Strong." },
  { type: "select", target: "dropdown#country", value: "United States", status: "success", duration: "0.8s", details: "195 options found. Matched at index 184." },
  { type: "click", target: "input#terms-checkbox", status: "running", duration: "—", details: "Toggling checkbox state..." },
  { type: "click", target: "button#submit", status: "pending", duration: "—", details: "Queued. Will trigger POST /api/auth/register" },
  { type: "wait", target: "**/dashboard**", status: "pending", duration: "—", details: "Will wait up to 5000ms for redirect" },
  { type: "assert", target: "h1.welcome-text", status: "pending", duration: "—", details: "Will verify welcome message is visible" },
];

const NETWORK_LOG = [
  { method: "GET", url: "/api/config", status: 200, duration: "45ms" },
  { method: "GET", url: "/api/auth/session", status: 200, duration: "120ms" },
  { method: "POST", url: "/api/auth/register", status: 422, duration: "340ms" },
  { method: "POST", url: "/api/auth/register", status: 201, duration: "280ms" },
  { method: "GET", url: "/api/user/profile", status: 200, duration: "95ms" },
];

const CONSOLE_LOGS = [
  { type: "info", text: "Glass browser initialized", time: "00:00.100" },
  { type: "info", text: "Navigating to signup page...", time: "00:01.200" },
  { type: "info", text: "Filling email field", time: "00:02.300" },
  { type: "warn", text: "422 response from /api/auth/register", time: "00:04.100" },
  { type: "error", text: "Missing required field: terms_accepted", time: "00:04.200" },
  { type: "info", text: "Retrying with terms checkbox...", time: "00:05.500" },
  { type: "info", text: "POST /api/auth/register → 201 Created", time: "00:06.300" },
];

const Execute = () => {
  const [command, setCommand] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [expandedAction, setExpandedAction] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [consoleFilter, setConsoleFilter] = useState<string>("all");
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [showFix, setShowFix] = useState(false);

  const doneCount = MOCK_ACTIONS.filter(a => a.status === "success").length;
  const runningIndex = MOCK_ACTIONS.findIndex(a => a.status === "running");
  const progress = Math.round(((doneCount + 0.5) / MOCK_ACTIONS.length) * 100);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => setElapsed(prev => +(prev + 0.1).toFixed(1)), 100);
    return () => clearInterval(timer);
  }, [isRunning]);

  const filteredConsole = consoleFilter === "all" ? CONSOLE_LOGS : CONSOLE_LOGS.filter(l => l.type === consoleFilter);
  const networkErrors = NETWORK_LOG.filter(r => r.status >= 400).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Command & Controls */}
      <GlassPanel glow="cyan" delay={0}>
        <div className="space-y-4">
          <div>
            <div className="font-mono text-xs text-muted-foreground mb-1">Command:</div>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              rows={2}
              disabled={isRunning}
              className="w-full font-mono text-sm text-foreground/60 bg-muted/10 rounded-lg px-3 py-2 border border-glass-border/60 outline-none focus:ring-1 focus:ring-primary/40 resize-none placeholder:text-muted-foreground/40 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Navigate to signup page, fill form with random data, select country, accept terms, submit"
            />
          </div>
          <div className="flex items-center justify-center gap-3">
            <AnimatePresence mode="wait">
              {!isRunning ? (
                <motion.button
                  key="run"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={() => { setIsRunning(true); setElapsed(0); }}
                  disabled={!command.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-xs font-semibold text-primary border border-primary/30 hover:border-primary/50 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "hsl(var(--glass-bg) / 0.25)",
                    backdropFilter: "blur(24px) saturate(1.4)",
                    WebkitBackdropFilter: "blur(24px) saturate(1.4)",
                    boxShadow: "inset 0 1px 0 0 hsl(0 0% 100% / 0.08), 0 2px 8px -2px hsl(0 0% 0% / 0.15)",
                  }}
                >
                  <Play className="w-3.5 h-3.5" /> Run
                </motion.button>
              ) : (
                <motion.div
                  key="controls"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-colors">
                    <Pause className="w-3 h-3" /> Pause
                  </button>
                  <button
                    onClick={() => setIsRunning(false)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </GlassPanel>

      {/* Status Banner */}
      <div className="glass-panel glass-glow-cyan p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <StatusBadge status="running" size="lg" />
          <div>
            <div className="font-mono text-2xl font-bold text-primary">{progress}%</div>
            <div className="font-mono text-[10px] text-muted-foreground">Action {doneCount + 1} of {MOCK_ACTIONS.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="font-mono text-lg font-bold text-foreground">{elapsed}s</div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase">Elapsed</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-lg font-bold text-muted-foreground whitespace-nowrap">~{(elapsed / progress * 100).toFixed(1)}s</div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase">ETA</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <LiquidProgress value={progress} label={`Executing: ${MOCK_ACTIONS[runningIndex]?.target || "..."}`} />

      {/* LIVE AUTOMATION VIEW — Terminal + Browser side by side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Live Terminal Logs */}
        <GlassPanel title="Live Terminal" icon="🖥️" glow="cyan" delay={0.1}>
          <LiveTerminal logs={CONSOLE_LOGS} />
        </GlassPanel>

        {/* Live Browser Preview */}
        <GlassPanel title="Live Browser" icon="🌐" glow="purple" delay={0.15}>
          <LiveBrowserPreview />
        </GlassPanel>
      </div>

      {/* Three column layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Action Timeline */}
        <GlassPanel title="Action Timeline" icon="📋" glow="cyan" delay={0.2}>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {MOCK_ACTIONS.map((action, i) => (
              <div key={i}>
                <div
                  onClick={() => setExpandedAction(expandedAction === i ? null : i)}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-xs font-mono overflow-hidden ${
                    action.status === "running" ? "bg-primary/10 border border-primary/20" :
                    action.status === "success" ? "hover:bg-muted/10" :
                    "opacity-50 hover:opacity-70"
                  } ${expandedAction === i ? "ring-1 ring-primary/20" : ""}`}
                >
                  <StatusBadge status={action.status} className="border-0 bg-transparent px-0 gap-0 shrink-0" />
                  <ActionBadge type={action.type} />
                  <span className="truncate text-foreground/70 flex-1 min-w-0">{action.target}</span>
                  <span className="text-muted-foreground text-[10px] shrink-0 ml-1">{action.duration}</span>
                </div>
                <AnimatePresence>
                  {expandedAction === i && action.details && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-6 my-1 px-3 py-2 rounded-lg border border-glass-border bg-muted/10 font-mono text-[11px] text-muted-foreground">
                        {action.details}
                        {action.value && <p className="text-primary/60 mt-1">Value: {action.value}</p>}
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
            <span className="font-mono text-xs text-primary">{NETWORK_LOG.length} requests</span>
            <span className="font-mono text-xs text-destructive">{networkErrors} error{networkErrors !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {NETWORK_LOG.map((req, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/10 transition-colors font-mono text-[11px] overflow-hidden">
                <span className={`font-semibold w-10 shrink-0 ${req.method === "POST" ? "text-secondary" : "text-primary"}`}>{req.method}</span>
                <span className="truncate flex-1 min-w-0 text-foreground/70">{req.url}</span>
                <span className={`shrink-0 ${req.status >= 400 ? "text-destructive" : "text-emerald-400"}`}>{req.status}</span>
                <span className="text-muted-foreground w-12 text-right shrink-0">{req.duration}</span>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* AI Diagnosis */}
        <GlassPanel title="AI Diagnosis" icon="🧠" glow="pink" delay={0.35}>
          <div className="glass-panel-strong p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-foreground">Missing Required Field</span>
              <span className="font-mono text-[10px] font-bold text-destructive">Critical</span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground space-y-1">
              <p><span className="text-secondary">Component:</span> AuthController.register()</p>
              <p><span className="text-primary">🎯 Root Cause:</span> POST /api/auth/register returned 422. Missing 'terms_accepted'.</p>
              <p><span className="text-emerald-400">💡 Fix:</span> Add checkbox interaction before submission.</p>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setShowDiagnosis(!showDiagnosis); setShowFix(false); }}
                className={`font-mono text-[10px] px-3 py-1.5 rounded-lg border transition-colors ${
                  showDiagnosis ? "border-primary bg-primary/15 text-primary" : "border-primary/30 text-primary hover:bg-primary/10"
                }`}
              >
                <span className="flex items-center gap-1"><Brain className="w-3 h-3" /> View Full Diagnosis</span>
              </button>
              <button
                onClick={() => { setShowFix(!showFix); setShowDiagnosis(false); }}
                className={`font-mono text-[10px] px-3 py-1.5 rounded-lg border transition-colors ${
                  showFix ? "border-emerald-400 bg-emerald-400/15 text-emerald-400" : "border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10"
                }`}
              >
                <span className="flex items-center gap-1"><Wrench className="w-3 h-3" /> Retry with Fix</span>
              </button>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* Full Diagnosis Overlay */}
      {createPortal(
        <AnimatePresence>
          {showDiagnosis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDiagnosis(false)}
              className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm flex items-center justify-center"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-[90vw] max-w-lg"
              >
                <div className="glass-panel p-5 space-y-4 border border-primary/20 rounded-2xl shadow-2xl"
                  style={{ background: "hsl(var(--glass-bg) / 0.85)", backdropFilter: "blur(40px) saturate(1.8)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      <span className="font-mono text-sm font-bold text-foreground">Full AI Diagnosis</span>
                    </div>
                    <button onClick={() => setShowDiagnosis(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 font-mono text-[11px]">
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3 h-3 text-destructive" />
                        <span className="font-semibold text-destructive">Error Trace</span>
                      </div>
                      <p className="text-muted-foreground">POST /api/auth/register → 422 Unprocessable Entity</p>
                      <p className="text-muted-foreground mt-1">Response body: <code className="text-destructive/80">{"{ \"error\": \"terms_accepted is required\" }"}</code></p>
                    </div>

                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className="w-3 h-3 text-primary" />
                        <span className="font-semibold text-primary">Root Cause Analysis</span>
                      </div>
                      <p className="text-muted-foreground">The registration endpoint requires a boolean <code className="text-primary/80">terms_accepted</code> field. The automation filled email and password but skipped the terms checkbox, resulting in a validation failure.</p>
                    </div>

                    <div className="p-3 rounded-lg bg-secondary/5 border border-secondary/15">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ArrowRight className="w-3 h-3 text-secondary" />
                        <span className="font-semibold text-secondary">Execution Timeline</span>
                      </div>
                      <div className="text-muted-foreground space-y-0.5">
                        <p>00:01.2s — Navigate to /signup ✓</p>
                        <p>00:02.3s — Fill email field ✓</p>
                        <p>00:02.5s — Fill password field ✓</p>
                        <p>00:03.3s — Select country ✓</p>
                        <p className="text-destructive">00:04.1s — Submit without terms ✗</p>
                        <p>00:05.5s — Retry with terms checkbox...</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground/60 italic">AI-powered analysis will provide real-time insights when connected.</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Fix Suggestion Overlay */}
      {createPortal(
        <AnimatePresence>
          {showFix && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFix(false)}
              className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm flex items-center justify-center"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-[90vw] max-w-lg"
              >
                <div className="glass-panel p-5 space-y-4 border border-emerald-400/20 rounded-2xl shadow-2xl"
                  style={{ background: "hsl(var(--glass-bg) / 0.85)", backdropFilter: "blur(40px) saturate(1.8)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-sm font-bold text-foreground">AI Suggested Fix</span>
                    </div>
                    <button onClick={() => setShowFix(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 font-mono text-[11px]">
                    <div className="p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/15">
                      <span className="font-semibold text-emerald-400">Proposed Action</span>
                      <p className="text-muted-foreground mt-1">Insert a <code className="text-emerald-400/80">click</code> action on <code className="text-emerald-400/80">#terms-checkbox</code> before the submit step.</p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/10 border border-glass-border">
                      <span className="font-semibold text-foreground/80">Modified Blueprint</span>
                      <div className="mt-2 text-muted-foreground space-y-0.5">
                        <p className="text-foreground/40">4. select → dropdown#country</p>
                        <p className="text-emerald-400 font-semibold">5. click → input#terms-checkbox ← NEW</p>
                        <p className="text-foreground/40">6. click → button#submit</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                      <span className="font-semibold text-primary">Confidence</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                          <div className="h-full w-[92%] rounded-full bg-emerald-400" />
                        </div>
                        <span className="text-emerald-400 font-bold">92%</span>
                      </div>
                    </div>
                  </div>

                  <button className="w-full font-mono text-[10px] px-3 py-2 rounded-lg bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/20 transition-colors">
                    Apply Fix & Re-run
                  </button>
                  <p className="text-[10px] text-muted-foreground/60 italic">AI-powered fix suggestions will be available when connected.</p>
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

// Streaming terminal component with auto-scroll
const LiveTerminal = ({ logs }: { logs: typeof CONSOLE_LOGS }) => {
  const [visibleLines, setVisibleLines] = useState<typeof CONSOLE_LOGS>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        const log = logs[i];
        if (log) {
          setVisibleLines(prev => [...prev, log]);
        }
        i++;
      } else {
        i = 0;
        setVisibleLines([]);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [logs]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleLines]);

  return (
    <div ref={scrollRef} className="glass-panel-strong p-3 font-mono text-xs max-h-[300px] overflow-y-auto rounded-lg">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-glass-border">
        <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-muted-foreground text-[10px]">npm://live-terminal</span>
      </div>
      {visibleLines.map((log, i) => (
        <motion.div
          key={`${i}-${log.time}`}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex gap-2 py-0.5"
        >
          <span className="text-muted-foreground shrink-0">[{log.time}]</span>
          <span className={
            log.type === "error" ? "text-destructive" :
            log.type === "warn" ? "text-amber-400" :
            "text-primary"
          }>{log.text}</span>
        </motion.div>
      ))}
      <span className="inline-block w-2 h-4 bg-primary animate-terminal-blink ml-1" />
    </div>
  );
};

export default Execute;
