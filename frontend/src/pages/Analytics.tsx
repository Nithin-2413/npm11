import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/GlassPanel";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, Zap, RefreshCw,
  BarChart2, Activity, Bug, Clock
} from "lucide-react";
import {
  getTimeSeries, getFlakyBlueprints, getPerformanceRegressions, getTopBlueprints,
  TimeSeriesPoint, FlakyBlueprint, Regression
} from "@/lib/api";
import { toast } from "sonner";

const PERIOD_OPTIONS = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
];

const Analytics = () => {
  const [period, setPeriod] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [flaky, setFlaky] = useState<FlakyBlueprint[]>([]);
  const [regressions, setRegressions] = useState<Regression[]>([]);
  const [topBps, setTopBps] = useState<{ name: string; usage_count: number }[]>([]);

  const loadData = async (p = period) => {
    setLoading(true);
    try {
      const [ts, fk, reg, top] = await Promise.all([
        getTimeSeries(p, p === "7d" ? "day" : p === "30d" ? "day" : "week"),
        getFlakyBlueprints(),
        getPerformanceRegressions(),
        getTopBlueprints(5),
      ]);
      setTimeSeries(ts.data);
      setFlaky(fk.flaky_blueprints);
      setRegressions(reg.regressions);
      setTopBps(top.blueprints);
    } catch (e) {
      toast.error("Failed to load analytics");
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalRuns = timeSeries.reduce((a, b) => a + b.total_executions, 0);
  const totalSuccess = timeSeries.reduce((a, b) => a + b.success_count, 0);
  const totalFailed = timeSeries.reduce((a, b) => a + b.failure_count, 0);
  const successRate = totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0;

  // Format x-axis labels
  const formatDate = (ts: string) => {
    try { return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
    catch { return ts; }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-foreground">Analytics</h1>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">Execution trends, flaky tests & performance regressions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-glass-border overflow-hidden">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setPeriod(opt.value); loadData(opt.value); }}
                className={`px-3 py-1.5 font-mono text-xs transition-colors ${
                  period === opt.value
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="p-2 rounded-lg border border-glass-border text-muted-foreground hover:text-primary transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Runs", value: totalRuns, icon: <Activity className="w-4 h-4" />, color: "text-primary" },
          { label: "Success Rate", value: `${successRate}%`, icon: <TrendingUp className="w-4 h-4" />, color: "text-emerald-400" },
          { label: "Failures", value: totalFailed, icon: <TrendingDown className="w-4 h-4" />, color: "text-destructive" },
          { label: "Flaky Tests", value: flaky.length, icon: <Bug className="w-4 h-4" />, color: "text-amber-400" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-muted-foreground">{stat.label}</span>
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <div className={`font-mono text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Time Series Chart */}
      <GlassPanel title="Executions Over Time" icon="📈" glow="cyan" delay={0.1}>
        {timeSeries.length === 0 ? (
          <div className="h-64 flex items-center justify-center font-mono text-xs text-muted-foreground">
            {loading ? "Loading..." : "No data for this period"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeSeries.map(d => ({ ...d, date: formatDate(d.timestamp) }))}>
              <defs>
                <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--glass-border) / 0.3)" />
              <XAxis dataKey="date" tick={{ fontFamily: "monospace", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontFamily: "monospace", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--glass-border))", borderRadius: 8, fontFamily: "monospace", fontSize: 11 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 11 }} />
              <Area type="monotone" dataKey="success_count" name="Success" stroke="hsl(var(--primary))" fill="url(#successGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="failure_count" name="Failure" stroke="hsl(var(--destructive))" fill="url(#failGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </GlassPanel>

      {/* Top Blueprints + Regressions */}
      <div className="grid lg:grid-cols-2 gap-6">
        <GlassPanel title="Top Blueprints by Usage" icon="🏆" glow="cyan" delay={0.15}>
          {topBps.length === 0 ? (
            <div className="h-48 flex items-center justify-center font-mono text-xs text-muted-foreground">
              {loading ? "Loading..." : "No blueprints used yet"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topBps} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--glass-border) / 0.3)" />
                <XAxis type="number" tick={{ fontFamily: "monospace", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontFamily: "monospace", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--glass-border))", borderRadius: 8, fontFamily: "monospace", fontSize: 11 }}
                />
                <Bar dataKey="usage_count" name="Usage Count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassPanel>

        <GlassPanel title="Performance Regressions" icon="⚠️" glow="pink" delay={0.2}>
          {regressions.length === 0 ? (
            <div className="h-48 flex items-center justify-center font-mono text-xs text-emerald-400">
              ✅ No performance regressions detected!
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {regressions.map((r, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="p-3 rounded-lg border border-amber-400/20 bg-amber-400/5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-semibold text-foreground">{r.name}</span>
                    <span className={`font-mono text-xs font-bold ${r.severity === "High" ? "text-destructive" : "text-amber-400"}`}>
                      +{r.change_percent}%
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    <span className="text-amber-400">Was:</span> {r.avg_duration_prev_s}s →
                    <span className="text-destructive"> Now:</span> {r.avg_duration_recent_s}s
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/70 mt-1">{r.recommendation}</p>
                </motion.div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      {/* Flaky Tests */}
      <GlassPanel title="Flaky Test Detection" icon="🐛" glow="cyan" delay={0.25}>
        {flaky.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-emerald-400">
            ✅ No flaky tests detected — all blueprints are stable!
          </div>
        ) : (
          <div className="space-y-3">
            {flaky.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="p-4 rounded-lg border border-amber-400/20 bg-amber-400/5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bug className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-mono text-xs font-semibold text-foreground">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{f.total_runs} runs</span>
                    <div className="w-24 h-2 rounded-full bg-muted/20 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${f.failure_rate * 100}%` }} />
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-400">{Math.round(f.failure_rate * 100)}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
                  <div>
                    <span className="text-muted-foreground">Pattern: </span>
                    <span className="text-foreground/70">{f.failure_pattern}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Error: </span>
                    <span className="text-destructive/80 truncate">{f.last_failure_reason.slice(0, 80)}</span>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/15 font-mono text-[10px]">
                  <span className="text-primary">💡 AI Recommendation: </span>
                  <span className="text-muted-foreground">{f.recommendation}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
};

export default Analytics;
