import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useParams, useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { StatusBadge, StatusType } from "@/components/StatusBadge";
import { ActionBadge, ActionType } from "@/components/ActionBadge";
import { LiquidProgress } from "@/components/LiquidProgress";
import {
  ArrowLeft, RotateCcw, Download, Trash2, Brain, Loader2
} from "lucide-react";
import { getReport, deleteReport, exportReport, Execution } from "@/lib/api";
import { toast } from "sonner";

const BACKEND_URL = (import.meta.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");

const ReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAction, setExpandedAction] = useState<number | null>(null);
  const [logFilter, setLogFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"timeline" | "network" | "console" | "ai">("timeline");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getReport(id)
      .then(setReport)
      .catch(() => toast.error("Failed to load report"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-7xl mx-auto">
        <GlassPanel glow="none">
          <div className="text-center py-12 font-mono text-sm text-muted-foreground">
            Report not found. <Link to="/reports" className="text-primary underline">Back to reports</Link>
          </div>
        </GlassPanel>
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteReport(report.execution_id);
      toast.success("Report deleted");
      navigate("/reports");
    } catch {
      toast.error("Delete failed");
    }
  };

  const statusColor = {
    SUCCESS: "text-emerald-400",
    FAILURE: "text-destructive",
    PARTIAL: "text-amber-400",
    CANCELLED: "text-muted-foreground",
    RUNNING: "text-primary",
  }[report.status] || "text-muted-foreground";

  const successPct = report.total_actions > 0 ? Math.round(report.successful_actions / report.total_actions * 100) : 0;
  const networkErrors = (report.network_logs || []).filter(r => r.is_error).length;
  const consoleLogs = report.console_logs || [];
  const filteredLogs = logFilter === "all" ? consoleLogs : consoleLogs.filter(l => l.type === logFilter);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link to="/reports" className="p-2 rounded-xl border border-glass-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-mono text-lg font-bold text-foreground truncate max-w-[500px]">
              {report.command || `Blueprint: ${report.blueprint_name}`}
            </h1>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{report.execution_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportReport(report.execution_id, "json")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button onClick={() => exportReport(report.execution_id, "html")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Export HTML
          </button>
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Status", value: report.status, color: statusColor },
          { label: "Duration", value: `${report.duration_seconds.toFixed(1)}s`, color: "text-primary" },
          { label: "Actions", value: `${report.successful_actions}/${report.total_actions}`, color: "text-emerald-400" },
          { label: "Network Errors", value: networkErrors.toString(), color: networkErrors > 0 ? "text-destructive" : "text-emerald-400" },
        ].map(s => (
          <div key={s.label} className="glass-panel p-4 text-center">
            <div className={`font-mono text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="font-mono text-[9px] text-muted-foreground uppercase mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <LiquidProgress value={successPct} label={`${report.successful_actions}/${report.total_actions} actions completed`} />

      {/* AI Summary */}
      {report.ai_summary && (
        <div className="glass-panel glass-glow-cyan p-4 flex items-start gap-3">
          <Brain className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-mono text-[10px] text-primary font-semibold mb-1">AI Summary</div>
            <p className="font-mono text-xs text-muted-foreground">{report.ai_summary}</p>
          </div>
        </div>
      )}

      {/* AI Analysis (if failed) */}
      {report.ai_analysis && (
        <div className="glass-panel p-4 border border-destructive/20 space-y-2">
          <div className="font-mono text-xs font-bold text-destructive flex items-center gap-2">
            <Brain className="w-4 h-4" /> AI Error Analysis
          </div>
          <div className="font-mono text-[11px] space-y-1">
            <p><span className="text-primary">Error Type:</span> <span className="text-foreground/70">{report.ai_analysis.error_type}</span></p>
            <p><span className="text-primary">Root Cause:</span> <span className="text-foreground/70">{report.ai_analysis.root_cause}</span></p>
            <p><span className="text-primary">Affected:</span> <span className="text-foreground/70">{report.ai_analysis.affected_component}</span></p>
            <p><span className="text-emerald-400">Fix:</span> <span className="text-foreground/70">{report.ai_analysis.suggested_fix}</span></p>
            {report.ai_analysis.full_analysis && (
              <p className="text-muted-foreground mt-2 border-t border-glass-border pt-2">{report.ai_analysis.full_analysis}</p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-glass-border pb-0">
        {(["timeline", "network", "console", "ai"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`font-mono text-xs px-4 py-2.5 capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >{tab}</button>
        ))}
      </div>

      {/* Timeline */}
      {activeTab === "timeline" && (
        <div className="space-y-2">
          {(report.action_timeline || []).length === 0 ? (
            <div className="glass-panel p-8 text-center font-mono text-xs text-muted-foreground">No action timeline data</div>
          ) : (report.action_timeline || []).map((action, i) => (
            <div key={i}>
              <div
                onClick={() => setExpandedAction(expandedAction === i ? null : i)}
                className={`glass-panel p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/5 transition-all ${
                  action.status === "failure" ? "border-destructive/20 bg-destructive/5" : ""
                }`}
              >
                <span className="font-mono text-[11px] text-muted-foreground w-6 shrink-0">#{i + 1}</span>
                <StatusBadge status={action.status as StatusType} size="sm" className="shrink-0" />
                <ActionBadge type={action.action_type as ActionType} />
                <span className="flex-1 font-mono text-xs text-foreground/70 truncate">
                  {action.selector || action.value || action.action_type}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">{action.duration_ms}ms</span>
                {action.screenshot_path && (
                  <a href={`${BACKEND_URL}${action.screenshot_path}`} target="_blank" rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] font-mono text-primary/60 hover:text-primary shrink-0">📸</a>
                )}
              </div>
              {expandedAction === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden ml-6"
                >
                  <div className="glass-panel-strong p-3 font-mono text-[11px] space-y-1">
                    <p><span className="text-primary">Type:</span> {action.action_type}</p>
                    {action.selector && <p><span className="text-primary">Selector:</span> {action.selector}</p>}
                    {action.value && <p><span className="text-primary">Value:</span> {action.value}</p>}
                    <p><span className="text-primary">Started:</span> {action.started_at}</p>
                    <p><span className="text-primary">Duration:</span> {action.duration_ms}ms</p>
                    {action.error_message && <p className="text-destructive">Error: {action.error_message}</p>}
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Network */}
      {activeTab === "network" && (
        <GlassPanel title={`Network Requests (${(report.network_logs || []).length})`} icon="🔮" glow="cyan">
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {(report.network_logs || []).length === 0 ? (
              <div className="text-center py-8 font-mono text-xs text-muted-foreground">No network logs captured</div>
            ) : (report.network_logs || []).map((req, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2 font-mono text-[11px] hover:bg-muted/10 rounded-lg transition-colors">
                <span className={`font-bold w-12 shrink-0 ${req.method === "POST" ? "text-secondary" : "text-primary"}`}>{req.method}</span>
                <span className={`shrink-0 ${req.status >= 400 ? "text-destructive" : "text-emerald-400"}`}>{req.status}</span>
                <span className="flex-1 truncate text-foreground/70">{req.url}</span>
                <span className="text-muted-foreground shrink-0">{req.duration_ms}ms</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Console */}
      {activeTab === "console" && (
        <GlassPanel title="Console Logs" icon="🖥️" glow="cyan">
          <div className="flex items-center gap-1 mb-3">
            {(["all", "log", "info", "warn", "error"] as const).map(f => (
              <button key={f} onClick={() => setLogFilter(f)}
                className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-colors capitalize ${logFilter === f ? "border-primary/40 text-primary bg-primary/10" : "border-glass-border text-muted-foreground hover:text-foreground"}`}
              >{f}</button>
            ))}
          </div>
          <div className="glass-panel-strong p-3 font-mono text-xs max-h-[350px] overflow-y-auto rounded-lg">
            {filteredLogs.length === 0 ? (
              <div className="text-muted-foreground/40">No console logs captured</div>
            ) : filteredLogs.map((log, i) => (
              <div key={i} className={`py-0.5 ${log.type === "error" ? "text-destructive" : log.type === "warn" ? "text-amber-400" : "text-foreground/70"}`}>
                <span className="text-muted-foreground mr-2">[{log.type}]</span>{log.text}
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* AI Tab — FIX 2: Always shows meaningful content */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          {report.ai_summary && (
            <GlassPanel title="AI Summary" icon="✨" glow="cyan">
              <p className="font-mono text-xs text-muted-foreground">{report.ai_summary}</p>
            </GlassPanel>
          )}

          {/* FIX 2: Check ai_analysis from top-level AND from action_timeline entries */}
          {(() => {
            // Collect all AI analyses: top-level + per-action
            const topLevelAnalysis = report.ai_analysis;
            const actionAnalyses = (report.action_timeline || [])
              .filter(a => a.ai_analysis)
              .map(a => ({ action: a, analysis: a.ai_analysis }));

            if (!topLevelAnalysis && actionAnalyses.length === 0) {
              // FIX 2: Show contextual empty state
              if (report.status === "FAILURE" || report.status === "PARTIAL") {
                return (
                  <GlassPanel glow="none">
                    <div className="text-center py-8 font-mono text-xs space-y-2">
                      <Brain className="w-8 h-8 text-amber-400/40 mx-auto" />
                      <p className="text-amber-400/80">Error occurred but AI analysis is unavailable.</p>
                      <p className="text-muted-foreground text-[10px]">Check network logs for details.</p>
                    </div>
                  </GlassPanel>
                );
              }
              return (
                <GlassPanel glow="none">
                  <div className="text-center py-8 font-mono text-xs text-emerald-400">
                    ✅ No errors detected — execution completed successfully! 🎉
                  </div>
                </GlassPanel>
              );
            }

            return (
              <>
                {topLevelAnalysis && (
                  <GlassPanel title="Error Analysis" icon="🧠" glow="pink">
                    <div className="space-y-3 font-mono text-[11px]">
                      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-destructive font-semibold">{topLevelAnalysis.error_type || "Error"}</div>
                          {topLevelAnalysis.impact_level && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">{topLevelAnalysis.impact_level}</span>
                          )}
                        </div>
                        <p className="text-muted-foreground">{topLevelAnalysis.root_cause}</p>
                        {topLevelAnalysis.raw_error && (
                          <p className="text-muted-foreground/50 text-[10px] mt-1 break-all font-mono">Raw: {topLevelAnalysis.raw_error}</p>
                        )}
                      </div>
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                        <div className="text-primary font-semibold mb-1">Affected: {topLevelAnalysis.affected_component}</div>
                        <p className="text-muted-foreground">{topLevelAnalysis.full_analysis || topLevelAnalysis.root_cause}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/15">
                        <div className="text-emerald-400 font-semibold mb-1">Suggested Fix</div>
                        <p className="text-muted-foreground">{topLevelAnalysis.suggested_fix}</p>
                      </div>
                      {topLevelAnalysis.confidence !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">AI Confidence:</span>
                          <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.round((topLevelAnalysis.confidence || 0) * 100)}%` }} />
                          </div>
                          <span className="text-emerald-400 font-bold">{Math.round((topLevelAnalysis.confidence || 0) * 100)}%</span>
                        </div>
                      )}
                    </div>
                  </GlassPanel>
                )}

                {/* Per-action AI analyses */}
                {actionAnalyses.map(({ action, analysis }, idx) => analysis && (
                  <GlassPanel key={idx} title={`Step #${(action.action_index || 0) + 1} Error`} icon="⚡" glow="none">
                    <div className="space-y-2 font-mono text-[11px]">
                      <p><span className="text-destructive">Type:</span> <span className="text-muted-foreground">{analysis.error_type || "unknown"}</span></p>
                      <p><span className="text-primary">Root Cause:</span> <span className="text-muted-foreground">{analysis.root_cause}</span></p>
                      <p><span className="text-emerald-400">Fix:</span> <span className="text-muted-foreground">{analysis.suggested_fix}</span></p>
                    </div>
                  </GlassPanel>
                ))}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ReportDetail;
