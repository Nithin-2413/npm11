import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, StatusType } from "@/components/StatusBadge";
import { LiquidProgress } from "@/components/LiquidProgress";
import { toast } from "sonner";
import {
  Play, FileCode2, Camera, RotateCcw, ChevronDown, ChevronRight,
  ArrowUpRight, Eye
} from "lucide-react";

const RECENT_EXECUTIONS = [
  { id: "exec_001", command: "Navigate to signup, fill form, submit", status: "success" as StatusType, time: "2m ago", duration: "6.5s", actions: "7/7" },
  { id: "exec_002", command: "Run blueprint: login_flow_v1", status: "success" as StatusType, time: "8m ago", duration: "2.1s", actions: "5/5" },
  { id: "exec_003", command: "Test checkout with expired card", status: "failure" as StatusType, time: "15m ago", duration: "4.8s", actions: "2/4" },
  { id: "exec_004", command: "Verify dashboard widgets load", status: "success" as StatusType, time: "22m ago", duration: "3.2s", actions: "3/3" },
  { id: "exec_005", command: "Upload avatar to profile settings", status: "partial" as StatusType, time: "35m ago", duration: "5.1s", actions: "4/6" },
  { id: "exec_006", command: "Run signup_flow_v1 with random data", status: "success" as StatusType, time: "48m ago", duration: "7.2s", actions: "7/7" },
];

const BLUEPRINTS_LIST = [
  { id: "signup_flow_v1", name: "Signup Flow" },
  { id: "login_flow_v1", name: "Login Flow" },
  { id: "checkout_flow_v1", name: "Checkout Flow" },
  { id: "profile_update_v1", name: "Profile Update" },
];

const ACTIVITY_DATA = [
  { day: "Mon", success: 18, failure: 2 },
  { day: "Tue", success: 24, failure: 3 },
  { day: "Wed", success: 15, failure: 1 },
  { day: "Thu", success: 28, failure: 4 },
  { day: "Fri", success: 32, failure: 2 },
  { day: "Sat", success: 12, failure: 0 },
  { day: "Sun", success: 13, failure: 1 },
];

// Portal-based dropdown to avoid overflow clipping
const BlueprintDropdown = ({ open, onToggle, onClose, onSelect }: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (id: string, name: string) => void;
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
            {BLUEPRINTS_LIST.map(bp => (
              <button
                key={bp.id}
                onClick={() => onSelect(bp.id, bp.name)}
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredExecs = tableFilter === "all" ? RECENT_EXECUTIONS : RECENT_EXECUTIONS.filter(e => e.status === tableFilter);
  const maxBar = Math.max(...ACTIVITY_DATA.map(d => d.success + d.failure));

  const handleExecute = () => {
    if (!command.trim()) {
      toast.error("Please enter a command to execute");
      return;
    }
    toast.success("Starting execution...");
    navigate("/execute");
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
        <StatCard icon="" label="Executions" value="1,247" subtext="+12% ↑ this week" color="cyan" />
        <StatCard icon="" label="Success Rate" value="94.2%" subtext="+2% this week" color="green" />
        <StatCard icon="" label="Avg Duration" value="4.8s" subtext="-0.3s vs last week" color="purple" />
        <StatCard icon="" label="Active Blueprints" value="12" subtext="3 used today" color="pink" />
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
              {filteredExecs.map((exec) => (
                <motion.div
                  key={exec.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 px-2 py-2.5 hover:bg-muted/10 transition-colors rounded-lg cursor-pointer group"
                  onClick={() => navigate(`/reports/${exec.id}`)}
                >
                  <StatusBadge status={exec.status} size="sm" className="shrink-0 border-0 bg-transparent px-0 gap-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-foreground/80 block truncate">{exec.command}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground">{exec.time}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">·</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{exec.duration}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">·</span>
                      <span className="font-mono text-[10px] text-primary">{exec.actions}</span>
                    </div>
                  </div>
                  <Link to={`/reports/${exec.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                    <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                  </Link>
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
        <GlassPanel title="Activity (7 Days)" icon="📊" glow="purple" delay={0.3}>
          <div className="space-y-3">
            {ACTIVITY_DATA.map((d) => (
              <motion.div
                key={d.day}
                className="flex items-center gap-3 group cursor-pointer"
                whileHover={{ x: 4 }}
                transition={{ duration: 0.2 }}
              >
                <span className="font-mono text-[10px] text-muted-foreground w-8 group-hover:text-foreground transition-colors">{d.day}</span>
                <div className="flex-1 flex items-center gap-1 h-6 relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.success / maxBar) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                    className="h-full rounded-l bg-emerald-400/30 border border-emerald-400/20 group-hover:bg-emerald-400/50 transition-colors"
                  />
                  {d.failure > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(d.failure / maxBar) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="h-full rounded-r bg-destructive/30 border border-destructive/20 group-hover:bg-destructive/50 transition-colors"
                    />
                  )}
                  {/* Tooltip on hover */}
                  <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 rounded-lg border border-glass-border text-[9px] font-mono text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10"
                    style={{ background: "hsl(var(--glass-bg))" }}
                  >
                    ✓ {d.success} &nbsp; ✗ {d.failure}
                  </div>
                </div>
                <span className="font-mono text-[9px] text-muted-foreground w-8 text-right group-hover:text-foreground transition-colors">{d.success + d.failure}</span>
              </motion.div>
            ))}
            <div className="flex items-center gap-4 pt-2 border-t border-glass-border">
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 rounded bg-emerald-400/30 border border-emerald-400/20" />
                <span className="font-mono text-[9px] text-muted-foreground">Success</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 rounded bg-destructive/30 border border-destructive/20" />
                <span className="font-mono text-[9px] text-muted-foreground">Failed</span>
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "New Blueprint", icon: "📐", path: "/blueprints/create" },
          { label: "View Reports", icon: "📋", path: "/reports" },
          { label: "Network Logs", icon: "🔮", path: "/network" },
          { label: "Settings", icon: "⚙️", path: "/settings" },
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
    </div>
  );
};

export default Dashboard;
