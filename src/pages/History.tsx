import { motion } from "framer-motion";
import { useState } from "react";
import { GlassPanel } from "@/components/GlassPanel";
import { LiquidProgress } from "@/components/LiquidProgress";
import { Link } from "react-router-dom";

interface ExecutionRecord {
  id: string;
  command: string;
  status: "success" | "failure" | "partial";
  timestamp: string;
  duration: string;
  stepsTotal: number;
  stepsDone: number;
  blueprint?: string;
  error?: string;
  details: {
    networkRequests: number;
    errorsDetected: number;
    aiDiagnoses: number;
  };
}

const MOCK_HISTORY: ExecutionRecord[] = [
  {
    id: "exec_001",
    command: "Navigate to signup page, fill form, select country, submit",
    status: "success",
    timestamp: "2026-02-24T14:32:00Z",
    duration: "6.5s",
    stepsTotal: 7,
    stepsDone: 7,
    blueprint: "signup_flow_v1",
    details: { networkRequests: 8, errorsDetected: 1, aiDiagnoses: 2 },
  },
  {
    id: "exec_002",
    command: "Run blueprint: login_flow_v1 with admin credentials",
    status: "success",
    timestamp: "2026-02-24T14:25:00Z",
    duration: "2.1s",
    stepsTotal: 5,
    stepsDone: 5,
    blueprint: "login_flow_v1",
    details: { networkRequests: 4, errorsDetected: 0, aiDiagnoses: 0 },
  },
  {
    id: "exec_003",
    command: "Test checkout flow with expired card",
    status: "failure",
    timestamp: "2026-02-24T14:18:00Z",
    duration: "4.8s",
    stepsTotal: 4,
    stepsDone: 2,
    error: "Payment declined: card_expired. Stripe returned 402.",
    details: { networkRequests: 6, errorsDetected: 2, aiDiagnoses: 1 },
  },
  {
    id: "exec_004",
    command: "Verify dashboard loads all widgets after login",
    status: "success",
    timestamp: "2026-02-24T14:10:00Z",
    duration: "3.2s",
    stepsTotal: 3,
    stepsDone: 3,
    details: { networkRequests: 12, errorsDetected: 0, aiDiagnoses: 0 },
  },
  {
    id: "exec_005",
    command: "Fill profile settings and upload avatar",
    status: "partial",
    timestamp: "2026-02-24T13:55:00Z",
    duration: "5.1s",
    stepsTotal: 6,
    stepsDone: 4,
    error: "File upload timed out after 5000ms",
    details: { networkRequests: 9, errorsDetected: 1, aiDiagnoses: 1 },
  },
  {
    id: "exec_006",
    command: "Run blueprint: signup_flow_v1 with random data",
    status: "success",
    timestamp: "2026-02-24T13:40:00Z",
    duration: "7.2s",
    stepsTotal: 7,
    stepsDone: 7,
    blueprint: "signup_flow_v1",
    details: { networkRequests: 8, errorsDetected: 1, aiDiagnoses: 2 },
  },
];

type FilterStatus = "all" | "success" | "failure" | "partial";

const statusBadge: Record<string, { label: string; class: string }> = {
  success: { label: "💎 Success", class: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  failure: { label: "❄️ Failed", class: "text-destructive border-destructive/30 bg-destructive/10" },
  partial: { label: "⚠️ Partial", class: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
};

const History = () => {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter === "all" ? MOCK_HISTORY : MOCK_HISTORY.filter((r) => r.status === filter);

  const stats = {
    total: MOCK_HISTORY.length,
    success: MOCK_HISTORY.filter((r) => r.status === "success").length,
    failure: MOCK_HISTORY.filter((r) => r.status === "failure").length,
    partial: MOCK_HISTORY.filter((r) => r.status === "partial").length,
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-glow-cyan/5 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-glow-purple/5 blur-[120px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">📜</span>
              <h1 className="text-2xl font-black tracking-tight gradient-text">Execution History</h1>
            </div>
            <p className="font-mono text-xs text-muted-foreground tracking-wider">
              Timeline of all glass-executed flows
            </p>
          </div>
          <Link
            to="/"
            className="font-mono text-xs px-4 py-2 rounded-xl border border-glass-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors glass-panel"
          >
            ← Dashboard
          </Link>
        </motion.header>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-primary" },
            { label: "Success", value: stats.success, color: "text-emerald-400" },
            { label: "Failed", value: stats.failure, color: "text-destructive" },
            { label: "Partial", value: stats.partial, color: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="glass-panel p-3 text-center">
              <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2">
          {(["all", "success", "failure", "partial"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-mono text-[11px] px-3 py-1.5 rounded-lg border transition-all capitalize ${
                filter === f
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-glass-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-glow-purple/20 to-transparent" />

          <div className="space-y-4">
            {filtered.map((record, i) => {
              const badge = statusBadge[record.status];
              const isExpanded = expandedId === record.id;

              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="relative pl-12"
                >
                  {/* Timeline dot */}
                  <div className={`absolute left-3 top-4 w-3 h-3 rounded-full border-2 ${
                    record.status === "success" ? "border-emerald-400 bg-emerald-400/30" :
                    record.status === "failure" ? "border-destructive bg-destructive/30" :
                    "border-amber-400 bg-amber-400/30"
                  }`} />

                  <div
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    className={`glass-panel p-4 cursor-pointer transition-all hover:bg-muted/5 ${isExpanded ? "ring-1 ring-primary/20" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm text-foreground truncate">{record.command}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(record.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">⏱ {record.duration}</span>
                          {record.blueprint && (
                            <span className="font-mono text-[10px] text-glow-purple">📐 {record.blueprint}</span>
                          )}
                        </div>
                      </div>
                      <span className={`font-mono text-[10px] px-2 py-1 rounded-lg border shrink-0 ${badge.class}`}>
                        {badge.label}
                      </span>
                    </div>

                    <LiquidProgress
                      value={Math.round((record.stepsDone / record.stepsTotal) * 100)}
                      label={`${record.stepsDone}/${record.stepsTotal} steps`}
                    />

                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 pt-3 border-t border-glass-border space-y-3"
                      >
                        <div className="grid grid-cols-3 gap-3">
                          <div className="glass-panel-strong p-3 text-center rounded-lg">
                            <p className="text-primary font-mono text-lg font-bold">{record.details.networkRequests}</p>
                            <p className="font-mono text-[9px] text-muted-foreground uppercase">Requests</p>
                          </div>
                          <div className="glass-panel-strong p-3 text-center rounded-lg">
                            <p className="text-destructive font-mono text-lg font-bold">{record.details.errorsDetected}</p>
                            <p className="font-mono text-[9px] text-muted-foreground uppercase">Errors</p>
                          </div>
                          <div className="glass-panel-strong p-3 text-center rounded-lg">
                            <p className="text-glow-purple font-mono text-lg font-bold">{record.details.aiDiagnoses}</p>
                            <p className="font-mono text-[9px] text-muted-foreground uppercase">AI Diagnoses</p>
                          </div>
                        </div>

                        {record.error && (
                          <div className="glass-panel-strong p-3 rounded-lg border-destructive/20">
                            <p className="font-mono text-[10px] text-destructive font-semibold mb-1">❄️ Error</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{record.error}</p>
                          </div>
                        )}

                        <button className="w-full font-mono text-[11px] px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
                          🔄 Replay this flow
                        </button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
