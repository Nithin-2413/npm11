import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionBadge, ActionType } from "@/components/ActionBadge";
import { LiquidProgress } from "@/components/LiquidProgress";
import {
  ArrowLeft, RotateCcw, Download, Share2, Trash2, Edit,
  ChevronDown, Copy, Image
} from "lucide-react";

const REPORT_DATA = {
  id: "exec_001",
  status: "success" as const,
  command: "Navigate to signup page, fill form with random data, select country, accept terms, submit",
  blueprint: "signup_flow_v1",
  version: "v1.2",
  startTime: "2026-02-24 14:32:00",
  duration: "6.5s",
  totalActions: 7,
  completedActions: 7,
  variables: { USER_EMAIL: "test_user@example.com", PASSWORD: "S3cureP@ss!", COUNTRY: "United States" },
  actions: [
    { type: "navigate" as ActionType, target: "https://app.example.com/signup", status: "success" as const, duration: "1.2s", screenshot: true },
    { type: "fill" as ActionType, target: "input#email", value: "test_user@example.com", status: "success" as const, duration: "0.3s" },
    { type: "fill" as ActionType, target: "input#password", value: "S3cureP@ss!", status: "success" as const, duration: "0.2s" },
    { type: "select" as ActionType, target: "dropdown#country", value: "United States", status: "success" as const, duration: "0.8s" },
    { type: "click" as ActionType, target: "input#terms-checkbox", status: "success" as const, duration: "0.1s" },
    { type: "click" as ActionType, target: "button#submit", status: "success" as const, duration: "0.4s", screenshot: true },
    { type: "wait" as ActionType, target: "**/dashboard**", status: "success" as const, duration: "0.3s", screenshot: true },
  ],
  network: [
    { method: "GET", url: "/api/config", status: 200, duration: "45ms", size: "1.2KB" },
    { method: "GET", url: "/api/auth/session", status: 200, duration: "120ms", size: "0.8KB" },
    { method: "POST", url: "/api/auth/register", status: 422, duration: "340ms", size: "0.4KB" },
    { method: "POST", url: "/api/auth/register", status: 201, duration: "280ms", size: "1.1KB" },
    { method: "GET", url: "/api/user/profile", status: 200, duration: "95ms", size: "2.3KB" },
    { method: "GET", url: "/api/dashboard", status: 200, duration: "210ms", size: "5.6KB" },
  ],
  consoleLogs: [
    { type: "info", text: "Navigating to signup...", time: "00:01.200" },
    { type: "info", text: "Filling form fields...", time: "00:02.300" },
    { type: "error", text: "422: terms_accepted is required", time: "00:04.100" },
    { type: "info", text: "Retrying with terms checkbox...", time: "00:05.500" },
    { type: "info", text: "201: Registration successful", time: "00:06.300" },
  ],
  performance: {
    pageLoadTime: "1.2s",
    avgActionDuration: "0.47s",
    totalWaitTime: "0.8s",
    networkBandwidth: "11.3KB",
    performanceScore: 92,
  },
};

const ReportDetail = () => {
  const { id } = useParams();
  const [expandedAction, setExpandedAction] = useState<number | null>(null);
  const [logFilter, setLogFilter] = useState("all");
  const report = REPORT_DATA;

  const filteredLogs = logFilter === "all" ? report.consoleLogs : report.consoleLogs.filter(l => l.type === logFilter);
  const networkErrors = report.network.filter(r => r.status >= 400).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link to="/reports" className="p-2 rounded-xl border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <StatusBadge status={report.status} size="md" />
              <h1 className="font-mono text-lg font-bold text-foreground">{report.id}</h1>
            </div>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              {report.startTime} • {report.duration} • {report.completedActions}/{report.totalActions} actions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
            <RotateCcw className="w-3 h-3" /> Re-run
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
            <Edit className="w-3 h-3" /> Edit & Re-run
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3 h-3" /> Export
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
            <Share2 className="w-3 h-3" /> Share
          </button>
        </div>
      </div>

      {/* Command & Variables */}
      <div className="grid md:grid-cols-2 gap-4">
        <GlassPanel title="Command" icon="⚡" glow="cyan">
          <pre className="font-mono text-xs text-foreground/80 bg-muted/20 rounded-lg p-3 border border-glass-border whitespace-pre-wrap">
            {report.command}
          </pre>
          {report.blueprint && (
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">Blueprint:</span>
              <span className="font-mono text-xs text-secondary">📐 {report.blueprint} {report.version}</span>
            </div>
          )}
        </GlassPanel>
        <GlassPanel title="Variables" icon="💉" glow="purple">
          <div className="space-y-2">
            {Object.entries(report.variables).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 font-mono text-xs">
                <span className="text-secondary">{`{{${key}}}`}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-foreground/80">{value}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      {/* Actions Accordion */}
      <GlassPanel title="Execution Timeline" icon="📋" glow="cyan" delay={0.1}>
        {/* Visual timeline bar */}
        <div className="flex items-center gap-0.5 mb-4">
          {report.actions.map((action, i) => (
            <div
              key={i}
              className="h-2 rounded-full flex-1 bg-emerald-400/30 border border-emerald-400/20"
              title={`${action.type}: ${action.target} (${action.duration})`}
            />
          ))}
        </div>

        <div className="space-y-1">
          {report.actions.map((action, i) => (
            <div key={i}>
              <div
                onClick={() => setExpandedAction(expandedAction === i ? null : i)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-muted/10 ${expandedAction === i ? "bg-muted/10 ring-1 ring-primary/20" : ""}`}
              >
                <StatusBadge status={action.status} className="border-0 bg-transparent px-0 gap-0" />
                <ActionBadge type={action.type} />
                <span className="font-mono text-xs text-foreground/70 truncate flex-1">{action.target}</span>
                {action.value && <span className="font-mono text-[10px] text-primary/60">→ {action.value}</span>}
                <span className="font-mono text-[10px] text-muted-foreground">{action.duration}</span>
                {(action as any).screenshot && <Image className="w-3 h-3 text-muted-foreground" />}
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${expandedAction === i ? "rotate-180" : ""}`} />
              </div>
              {expandedAction === i && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="ml-8 my-1 p-3 rounded-lg border border-glass-border bg-muted/10 font-mono text-[11px] text-muted-foreground space-y-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-primary">Selector:</span> {action.target}</div>
                    {action.value && <div><span className="text-secondary">Value:</span> {action.value}</div>}
                    <div><span className="text-emerald-400">Duration:</span> {action.duration}</div>
                    <div><span className="text-amber-400">Status:</span> {action.status}</div>
                  </div>
                  {(action as any).screenshot && (
                    <div className="aspect-video bg-muted/20 rounded-lg border border-glass-border flex items-center justify-center mt-2">
                      <span className="text-[10px] text-muted-foreground">📸 Screenshot captured</span>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Network & Console */}
      <div className="grid md:grid-cols-2 gap-6">
        <GlassPanel title="Network Activity" icon="🔮" glow="cyan" delay={0.2}>
          <div className="flex items-center gap-3 mb-3 font-mono text-xs">
            <span className="text-primary">{report.network.length} requests</span>
            <span className={networkErrors > 0 ? "text-destructive" : "text-muted-foreground"}>{networkErrors} errors</span>
          </div>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {report.network.map((req, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/10 transition-colors font-mono text-[11px]">
                <span className={`font-semibold w-10 ${req.method === "POST" ? "text-secondary" : "text-primary"}`}>{req.method}</span>
                <span className="truncate flex-1 text-foreground/70">{req.url}</span>
                <span className={req.status >= 400 ? "text-destructive" : "text-emerald-400"}>{req.status}</span>
                <span className="text-muted-foreground w-12 text-right">{req.duration}</span>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel title="Console Logs" icon="🖥️" glow="none" delay={0.3}>
          <div className="flex items-center gap-2 mb-3">
            {["all", "info", "warn", "error"].map(f => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`font-mono text-[10px] px-2 py-1 rounded border transition-all capitalize ${
                  logFilter === f ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
            <button className="ml-auto font-mono text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <div className="glass-panel-strong p-3 font-mono text-[11px] max-h-[250px] overflow-y-auto rounded-lg">
            {filteredLogs.map((log, i) => (
              <div key={i} className="flex gap-2 py-0.5">
                <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                <span className={
                  log.type === "error" ? "text-destructive" :
                  log.type === "warn" ? "text-amber-400" : "text-primary"
                }>{log.text}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      {/* Performance */}
      <GlassPanel title="Performance Metrics" icon="⚡" glow="purple" delay={0.4}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Page Load", value: report.performance.pageLoadTime, color: "text-primary" },
            { label: "Avg Action", value: report.performance.avgActionDuration, color: "text-secondary" },
            { label: "Wait Time", value: report.performance.totalWaitTime, color: "text-muted-foreground" },
            { label: "Bandwidth", value: report.performance.networkBandwidth, color: "text-amber-400" },
            { label: "Score", value: `${report.performance.performanceScore}/100`, color: "text-emerald-400" },
          ].map((metric) => (
            <div key={metric.label} className="text-center glass-panel-strong p-3 rounded-lg">
              <div className={`font-mono text-lg font-bold ${metric.color}`}>{metric.value}</div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase">{metric.label}</div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
};

export default ReportDetail;
