import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, StatusType } from "@/components/StatusBadge";
import { toast } from "sonner";
import {
  Play, FileCode2, Camera, RotateCcw, ChevronDown, ChevronRight,
  ArrowUpRight, Eye, Loader2
} from "lucide-react";
import { getReportStats, listReports, listBlueprints, listSchedules, Execution, Blueprint, Schedule } from "@/lib/api";

// Portal-based dropdown to avoid overflow clipping
const BlueprintDropdown = ({ open, onToggle, onClose, onSelect, blueprints }: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (id: string, name: string) => void;
  blueprints: Blueprint[];
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: rect.left });
    }
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
      >
        <FileCode2 className="w-3.5 h-3.5" />
        Use Blueprint
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed w-56 rounded-xl border border-glass-border p-1 z-[100] shadow-2xl"
            style={{ top: pos.top, left: pos.left, background: "hsl(var(--popover))", backdropFilter: "blur(40px)" }}
          >
            {blueprints.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground font-mono">No blueprints</div>}
            {blueprints.map(bp => (
              <button
                key={bp.blueprint_id}
                onClick={() => onSelect(bp.blueprint_id, bp.name)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs text-foreground/80 hover:bg-primary/10 hover:text-primary transition-colors text-left"
              >
                <FileCode2 className="w-3 h-3 text-secondary" />
                {bp.name}
              </button>
            ))}
            <div className="border-t border-glass-border mt-1 pt-1">
              <Link
                to="/blueprints"
                onClick={onClose}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-[10px] text-muted-foreground hover:text-primary transition-colors"
              >
                View All Blueprints <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        </>,
        document.body
      )}
    </>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [command, setCommand] = useState("");
  const [recording, setRecording] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [headless, setHeadless] = useState(true);
  const [screenshotOnError, setScreenshotOnError] = useState(true);
  const [retryFailed, setRetryFailed] = useState(false);
  const [timeout, setTimeout_] = useState(15);
  const [tableFilter, setTableFilter] = useState<"all" | StatusType>("all");
  const [blueprintDropdownOpen, setBlueprintDropdownOpen] = useState(false);

  // Real data
  const [stats, setStats] = useState<{
    total_executions: number; success_rate: number; avg_duration: number; total_blueprints: number;
    executions_today: number; executions_this_week: number;
  } | null>(null);
  const [recentExecs, setRecentExecs] = useState<Execution[]>([]);
  const [blueprintsList, setBlueprintsList] = useState<Blueprint[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, reportsData, bpData, schedData] = await Promise.all([
          getReportStats(),
          listReports({ page: 1, page_size: 10 }),
          listBlueprints({ page_size: 20 } as never),
          listSchedules().catch(() => ({ schedules: [] })),
        ]);
        setStats(statsData);
        setRecentExecs(reportsData.reports);
        setBlueprintsList(bpData.blueprints);
        const upcoming = schedData.schedules
          .filter(s => s.is_active && !s.is_paused && s.next_run)
          .sort((a, b) => new Date(a.next_run!).getTime() - new Date(b.next_run!).getTime())
          .slice(0, 5);
        setUpcomingSchedules(upcoming);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // Reduced polling to minimize perceived "activity"
    const interval = setInterval(fetchData, 120000); // refresh every 2 minutes (was 60s)
    return () => clearInterval(interval);
  }, []);

  const filteredExecs = tableFilter === "all" ? recentExecs : recentExecs.filter(e => e.status.toLowerCase() === tableFilter);

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const handleExecute = () => {
    if (!command.trim()) {
      toast.error("Please enter a command to execute");
      return;
    }
    navigate("/execute", { state: { command } });
  };

  const handleUseBlueprint = (blueprintId: string, blueprintName: string) => {
    setCommand(`Run blueprint: ${blueprintName}`);
    setBlueprintDropdownOpen(false);
    toast.info(`Blueprint "${blueprintName}" loaded`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Hero Execute Card */}
      <GlassPanel glow="cyan" delay={0.1} className="relative">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">⚡</span>
          <h2 className="font-mono text-sm font-semibold tracking-wider uppercase text-primary">Quick Execute</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-primary/30 to-transparent" />
        </div>

        <textarea
          value={command}
          onChange={(e) => {
            setCommand(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleExecute(); }}
          placeholder="Enter natural language command...&#10;e.g. Navigate to signup page, fill form with random data, submit&#10;&#10;Press ⌘+Enter to execute"
          rows={2}
          className="w-full bg-muted/20 border border-glass-border rounded-xl px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 resize-none overflow-hidden"
          style={{ minHeight: "60px" }}
        />

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <button
            onClick={handleExecute}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors glass-glow-cyan"
          >
            <Play className="w-3.5 h-3.5" />
            Execute Now
          </button>

          <BlueprintDropdown
            open={blueprintDropdownOpen}
            onToggle={() => setBlueprintDropdownOpen(!blueprintDropdownOpen)}
            onClose={() => setBlueprintDropdownOpen(false)}
            onSelect={handleUseBlueprint}
            blueprints={blueprintsList}
          />

          <label className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <div className={`w-8 h-4 rounded-full flex items-center transition-colors ${recording ? "bg-destructive/60" : "bg-muted/40"}`}>
              <div className={`w-3.5 h-3.5 rounded-full bg-foreground transition-transform ${recording ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className={recording ? "text-destructive" : ""}>
              {recording ? "🔴 Recording" : "🎥 Record"}
            </span>
            <input type="checkbox" className="sr-only" checked={recording} onChange={() => { setRecording(!recording); toast.info(recording ? "Recording stopped" : "Recording started"); }} />
          </label>

          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center gap-1 ml-auto font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${advancedOpen ? "rotate-90" : ""}`} />
            Advanced Options
          </button>
        </div>

        <AnimatePresence>
          {advancedOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-3 pt-3 border-t border-glass-border grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={headless} onChange={() => setHeadless(!headless)} className="accent-primary" />
                Headless Mode
              </label>
              <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={screenshotOnError} onChange={() => setScreenshotOnError(!screenshotOnError)} className="accent-primary" />
                <Camera className="w-3 h-3" />
                Screenshot on Error
              </label>
              <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={retryFailed} onChange={() => setRetryFailed(!retryFailed)} className="accent-primary" />
                <RotateCcw className="w-3 h-3" />
                Retry Failed
              </label>
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-muted-foreground">Timeout: {timeout}s</span>
                <input
                  type="range"
                  min={5}
                  max={60}
                  value={timeout}
                  onChange={(e) => setTimeout_(parseInt(e.target.value))}
                  className="w-full h-1 bg-muted/40 rounded-full appearance-none accent-primary"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassPanel>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="glass-panel p-4 animate-pulse">
              <div className="h-4 bg-muted/20 rounded mb-2" />
              <div className="h-8 bg-muted/20 rounded" />
            </div>
          ))
        ) : (
          <>
            <StatCard icon="" label="Executions" value={stats?.total_executions?.toLocaleString() || "0"} subtext={`${stats?.executions_today || 0} today`} color="cyan" />
            <StatCard icon="" label="Success Rate" value={stats ? `${(stats.success_rate * 100).toFixed(1)}%` : "—"} subtext={`${stats?.executions_this_week || 0} this week`} color="green" />
            <StatCard icon="" label="Avg Duration" value={stats ? `${stats.avg_duration.toFixed(1)}s` : "—"} subtext="per execution" color="purple" />
            <StatCard icon="" label="Blueprints" value={stats?.total_blueprints?.toString() || "0"} subtext="available" color="pink" />
          </>
        )}
      </div>

      {/* Two column: Table + Activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Executions Table */}
        <div className="lg:col-span-2">
          <GlassPanel title="Recent Executions" icon="📋" glow="cyan" delay={0.2}>
            <div className="flex items-center gap-2 mb-3">
              {(["all", "success", "failure", "partial"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTableFilter(f)}
                  className={`font-mono text-[10px] px-2.5 py-1 rounded-lg border transition-all capitalize ${
                    tableFilter === f
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="divide-y divide-glass-border/50">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredExecs.length === 0 ? (
                <div className="text-center py-8 font-mono text-xs text-muted-foreground">
                  No executions yet. Run a command to get started!
                </div>
              ) : filteredExecs.map((exec) => (
                <motion.div
                  key={exec.execution_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 px-2 py-2.5 hover:bg-muted/10 transition-colors rounded-lg cursor-pointer group"
                  onClick={() => navigate(`/reports/${exec.execution_id}`)}
                >
                  <StatusBadge status={exec.status.toLowerCase() as StatusType} size="sm" className="shrink-0 border-0 bg-transparent px-0 gap-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-foreground/80 block truncate">
                      {exec.command || `Blueprint: ${exec.blueprint_name}`}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground">{formatTime(exec.timestamp)}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">·</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{exec.duration_seconds.toFixed(1)}s</span>
                      <span className="font-mono text-[10px] text-muted-foreground">·</span>
                      <span className="font-mono text-[10px] text-primary">{exec.successful_actions}/{exec.total_actions}</span>
                    </div>
                  </div>
                  <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity" />
                </motion.div>
              ))}
            </div>

            <Link
              to="/reports"
              className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-glass-border font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              View All Executions <ArrowUpRight className="w-3 h-3" />
            </Link>
          </GlassPanel>
        </div>

        {/* Activity Graph */}
        <GlassPanel title="Recent Errors" icon="⚠️" glow="purple" delay={0.3}>
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (stats?.recent_errors?.length === 0) ? (
              <div className="text-center py-8 font-mono text-xs text-emerald-400">No recent errors 🎉</div>
            ) : stats?.recent_errors?.map((err, i) => (
              <div key={i} className="p-3 rounded-lg bg-destructive/5 border border-destructive/10 font-mono text-[11px] cursor-pointer hover:bg-destructive/10 transition-colors"
                onClick={() => navigate(`/reports/${err.execution_id}`)}
              >
                <div className="text-destructive truncate">{err.error_message || "Execution failed"}</div>
                <div className="text-muted-foreground mt-1 truncate">{err.command}</div>
                <div className="text-muted-foreground/60 text-[10px]">{err.timestamp ? formatTime(err.timestamp) : ""}</div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "New Blueprint", icon: "📐", path: "/blueprints/create" },
          { label: "View Reports", icon: "📋", path: "/reports" },
          { label: "Analytics", icon: "📊", path: "/analytics" },
          { label: "Schedules", icon: "⏰", path: "/schedules" },
        ].map((action) => (
          <Link
            key={action.label}
            to={action.path}
            className="glass-panel p-4 flex items-center gap-3 hover:bg-muted/10 transition-colors group"
          >
            <span className="text-lg">{action.icon}</span>
            <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">{action.label}</span>
            <ArrowUpRight className="w-3 h-3 ml-auto text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>

      {/* Upcoming Schedules widget */}
      {upcomingSchedules.length > 0 && (
        <GlassPanel title="Upcoming Scheduled Runs" icon="⏰" glow="cyan" delay={0.3}>
          <div className="space-y-2">
            {upcomingSchedules.map((s) => (
              <div key={s.schedule_id} className="flex items-center justify-between font-mono text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary/60" />
                  <span className="text-foreground/80">{s.name}</span>
                  <span className="text-muted-foreground text-[10px]">{s.blueprint_name}</span>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground text-[10px]">
                    {s.next_run ? new Date(s.next_run).toLocaleString() : "—"}
                  </div>
                  <div className="text-[10px] text-primary">{s.cron_expression}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
};

export default Dashboard;
