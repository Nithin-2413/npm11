import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/GlassPanel";
import { StatusBadge, StatusType } from "@/components/StatusBadge";
import {
  Clock, Plus, Trash2, Play, Pause, RotateCcw, ChevronDown,
  Check, X, Calendar, RefreshCw, AlertCircle
} from "lucide-react";
import {
  listSchedules, createSchedule, deleteSchedule, pauseSchedule,
  resumeSchedule, runScheduleNow, listBlueprints, Schedule, Blueprint
} from "@/lib/api";
import { toast } from "sonner";

const TIMEZONES = [
  "UTC", "Asia/Kolkata", "America/New_York", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore",
  "Australia/Sydney", "America/Chicago",
];

const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 9 AM", value: "0 9 * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every Monday at 9 AM", value: "0 9 * * 1" },
  { label: "Every weekday at 9 AM", value: "0 9 * * 1-5" },
  { label: "Every Sunday at midnight", value: "0 0 * * 0" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
];

function cronToHuman(cron: string): string {
  const preset = CRON_PRESETS.find(p => p.value === cron);
  if (preset) return preset.label;
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [min, hour, day, month, dow] = parts;
  if (min !== "*" && hour !== "*" && day === "*" && month === "*" && dow === "*")
    return `Every day at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  if (min !== "*" && hour !== "*" && day === "*" && month === "*")
    return `Cron: ${cron}`;
  return cron;
}

interface ScheduleFormData {
  name: string;
  blueprint_id: string;
  cron_expression: string;
  timezone: string;
  notification_on_failure: boolean;
}

const Schedules = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ScheduleFormData>({
    name: "", blueprint_id: "", cron_expression: "0 9 * * *",
    timezone: "UTC", notification_on_failure: true,
  });
  const [saving, setSaving] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([listSchedules(), listBlueprints()]);
      setSchedules(s.schedules);
      setBlueprints(b.blueprints);
    } catch (e) { toast.error("Failed to load schedules"); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.blueprint_id) return;
    setSaving(true);
    try {
      await createSchedule(form);
      toast.success("Schedule created!");
      setShowCreate(false);
      setForm({ name: "", blueprint_id: "", cron_expression: "0 9 * * *", timezone: "UTC", notification_on_failure: true });
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create schedule");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSchedule(id);
      toast.success("Schedule deleted");
      setSchedules(s => s.filter(x => x.schedule_id !== id));
    } catch { toast.error("Failed to delete"); }
  };

  const handlePause = async (id: string, is_paused: boolean) => {
    try {
      if (is_paused) { await resumeSchedule(id); toast.success("Schedule resumed"); }
      else { await pauseSchedule(id); toast.success("Schedule paused"); }
      await loadAll();
    } catch { toast.error("Failed to update schedule"); }
  };

  const handleRunNow = async (id: string) => {
    setTriggeringId(id);
    try {
      const r = await runScheduleNow(id);
      toast.success(`Triggered! Execution: ${r.execution_id}`);
    } catch { toast.error("Failed to trigger"); }
    setTriggeringId(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-foreground">Schedules</h1>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">Automate blueprint execution on a cron schedule</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="p-2 rounded-lg border border-glass-border text-muted-foreground hover:text-primary">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Schedule
          </button>
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-glass-border shadow-2xl"
              style={{ background: "hsl(var(--glass-bg) / 0.9)", backdropFilter: "blur(40px)" }}
            >
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-sm font-bold text-foreground">New Schedule</h2>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="font-mono text-xs text-muted-foreground mb-1 block">Schedule Name</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                      placeholder="Daily Login Test"
                      className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted-foreground mb-1 block">Blueprint</label>
                    <select value={form.blueprint_id} onChange={e => setForm(f => ({ ...f, blueprint_id: e.target.value }))} required
                      className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      <option value="">Select blueprint...</option>
                      {blueprints.map(bp => <option key={bp.blueprint_id} value={bp.blueprint_id}>{bp.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted-foreground mb-1 block">Schedule Preset</label>
                    <select value={form.cron_expression} onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
                      className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted-foreground mb-1 block">Cron Expression</label>
                    <input value={form.cron_expression} onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
                      placeholder="0 9 * * *"
                      className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <p className="font-mono text-[10px] text-primary mt-1">→ {cronToHuman(form.cron_expression)}</p>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted-foreground mb-1 block">Timezone</label>
                    <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                      className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    >
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.notification_on_failure} onChange={e => setForm(f => ({ ...f, notification_on_failure: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded accent-primary" />
                    <span className="font-mono text-xs text-muted-foreground">Notify on failure</span>
                  </label>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 font-mono text-xs py-2 rounded-xl border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 font-mono text-xs py-2 rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50">
                    {saving ? "Creating..." : "Create Schedule"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedules List */}
      {loading ? (
        <div className="text-center py-16 font-mono text-xs text-muted-foreground">Loading schedules...</div>
      ) : schedules.length === 0 ? (
        <GlassPanel glow="cyan" delay={0.1}>
          <div className="text-center py-12 space-y-3">
            <Calendar className="w-10 h-10 text-primary/40 mx-auto" />
            <p className="font-mono text-sm font-bold text-foreground">No schedules yet</p>
            <p className="font-mono text-xs text-muted-foreground max-w-xs mx-auto">
              Create a schedule to automatically run your blueprints on a cron expression.
            </p>
            <button onClick={() => setShowCreate(true)}
              className="mx-auto flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Create First Schedule
            </button>
          </div>
        </GlassPanel>
      ) : (
        <div className="space-y-3">
          {schedules.map((s, i) => (
            <motion.div key={s.schedule_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="glass-panel p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`p-2 rounded-lg ${s.is_paused ? "bg-muted/20" : "bg-primary/10"}`}>
                    <Clock className={`w-4 h-4 ${s.is_paused ? "text-muted-foreground" : "text-primary"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground">{s.name}</span>
                      {s.is_paused && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground">PAUSED</span>}
                      {s.last_status && (
                        <StatusBadge status={s.last_status.toLowerCase() as StatusType} />
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                      <span className="text-primary">{s.cron_expression}</span>
                      <span className="mx-1">·</span>
                      {cronToHuman(s.cron_expression)}
                      <span className="mx-1">·</span>
                      {s.timezone}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      Blueprint: <span className="text-foreground/60">{s.blueprint_name || s.blueprint_id}</span>
                      {s.next_run && <span className="ml-2">· Next: {new Date(s.next_run).toLocaleString()}</span>}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-1">
                      <span className="text-emerald-400">{s.success_count}✓</span>
                      <span className="mx-1">/</span>
                      <span className="text-destructive">{s.failure_count}✗</span>
                      <span className="mx-1">of</span>
                      <span>{s.run_count} runs</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRunNow(s.schedule_id)}
                    disabled={triggeringId === s.schedule_id}
                    title="Run now"
                    className="p-2 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {triggeringId === s.schedule_id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handlePause(s.schedule_id, s.is_paused)}
                    title={s.is_paused ? "Resume" : "Pause"}
                    className="p-2 rounded-lg border border-glass-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {s.is_paused ? <RotateCcw className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(s.schedule_id)}
                    title="Delete"
                    className="p-2 rounded-lg border border-destructive/20 text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Schedules;
