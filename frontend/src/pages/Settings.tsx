import { useState, useEffect, useCallback } from "react";
import { GlassPanel } from "@/components/GlassPanel";
import { toast } from "sonner";
import {
  Monitor, Globe, Wifi, Brain, FileCode2, ClipboardList,
  Zap, Database, ChevronRight, Save, RotateCcw, Trash2,
  TestTube, Lock, Users, Copy, Eye, EyeOff, Plus, Key
} from "lucide-react";
import {
  listSecrets, createSecret, deleteSecret, Secret,
  listWebhooks, createWebhook, deleteWebhook, Webhook,
  listBlueprints, Blueprint,
  listWorkspaces, createWorkspace, inviteMember, Workspace
} from "@/lib/api";

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const SECTIONS: SettingsSection[] = [
  { id: "general", label: "General", icon: <Monitor className="w-4 h-4" /> },
  { id: "browser", label: "Browser", icon: <Globe className="w-4 h-4" /> },
  { id: "network", label: "Network", icon: <Wifi className="w-4 h-4" /> },
  { id: "ai", label: "AI & LLM", icon: <Brain className="w-4 h-4" /> },
  { id: "blueprints", label: "Blueprints", icon: <FileCode2 className="w-4 h-4" /> },
  { id: "reports", label: "Reports", icon: <ClipboardList className="w-4 h-4" /> },
  { id: "secrets", label: "Secrets", icon: <Lock className="w-4 h-4" /> },
  { id: "cicd", label: "CI/CD", icon: <Zap className="w-4 h-4" /> },
  { id: "team", label: "Team", icon: <Users className="w-4 h-4" /> },
  { id: "advanced", label: "Advanced", icon: <Database className="w-4 h-4" /> },
];

const DEFAULTS = {
  theme: "dark",
  glassIntensity: 75,
  notifications: true,
  emailNotifs: false,
  browser: "chromium",
  headless: true,
  defaultTimeout: 15,
  slowMotion: 0,
  autoScreenshot: true,
  videoRecording: false,
  interceptAll: true,
  captureHeaders: true,
  captureBodies: true,
  logConsole: true,
  aiProvider: "groq",
  aiModel: "qwen2.5-coder-32b",
  temperature: 30,
  streaming: true,
  autoAnalyze: true,
  autoSave: true,
  validateSelectors: true,
  reportFormat: "json",
  autoExport: false,
  retentionDays: 30,
  includeScreenshots: true,
  includeNetwork: true,
  includeConsole: true,
  parallelExec: 3,
  maxRetries: 2,
  debugMode: false,
  integrations: { slack: false, github: true, email: false, webhooks: false } as Record<string, boolean>,
};

type SettingsState = typeof DEFAULTS;

function loadSettings(): SettingsState {
  try {
    const saved = localStorage.getItem("npm-settings");
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULTS };
}

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
  <label className="flex items-center justify-between cursor-pointer group">
    <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
    <div onClick={onChange} className={`w-9 h-5 rounded-full flex items-center transition-colors cursor-pointer ${checked ? "bg-primary/40" : "bg-muted/40"}`}>
      <div className="w-4 h-4 rounded-full bg-foreground transition-transform" style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }} />
    </div>
  </label>
);

const Slider = ({ value, onChange, min, max, label, unit }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string; unit: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-primary">{value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="w-full h-1 bg-muted/40 rounded-full appearance-none accent-primary" />
  </div>
);

const Settings = () => {
  const [activeSection, setActiveSection] = useState("general");
  const [settings, setSettings] = useState<SettingsState>(loadSettings);
  const [dirty, setDirty] = useState(false);

  // Sync theme when changed externally (header toggle)
  useEffect(() => {
    const handler = (e: Event) => {
      const theme = (e as CustomEvent).detail as string;
      setSettings(prev => prev.theme === theme ? prev : { ...prev, theme });
    };
    window.addEventListener("theme-changed", handler);
    return () => window.removeEventListener("theme-changed", handler);
  }, []);

  const set = useCallback(<K extends keyof SettingsState>(key: K, val: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    setDirty(true);

    // Apply theme immediately and notify header
    if (key === "theme") {
      applyTheme(val as string);
      window.dispatchEvent(new CustomEvent("theme-changed", { detail: val }));
    }
  }, []);

  const applyTheme = useCallback((theme: string) => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else if (theme === "dark") {
      root.classList.remove("light");
    } else {
      // auto: follow system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.remove("light");
      } else {
        root.classList.add("light");
      }
    }
  }, []);

  const saveSettings = useCallback(() => {
    localStorage.setItem("npm-settings", JSON.stringify(settings));
    setDirty(false);
    toast.success("Settings saved successfully");
  }, [settings]);

  const resetDefaults = useCallback(() => {
    setSettings({ ...DEFAULTS });
    localStorage.removeItem("npm-settings");
    setDirty(false);
    toast.info("Settings reset to defaults");
  }, []);

  const clearAllData = useCallback(() => {
    localStorage.clear();
    setSettings({ ...DEFAULTS });
    setDirty(false);
    toast.success("All data cleared");
  }, []);

  const toggleIntegration = useCallback((name: string) => {
    setSettings(prev => ({
      ...prev,
      integrations: { ...prev.integrations, [name]: !prev.integrations[name] },
    }));
    setDirty(true);
  }, []);

  const renderSection = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Theme</h3>
              <div className="flex gap-2">
                {["dark", "light", "auto"].map(t => (
                  <button key={t} onClick={() => set("theme", t)}
                    className={`font-mono text-xs px-4 py-2 rounded-xl border transition-all capitalize ${
                      settings.theme === t ? "border-primary/40 bg-primary/10 text-primary" : "border-glass-border text-muted-foreground hover:text-foreground"
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div className="border-t border-glass-border pt-4 space-y-3">
              <h3 className="font-mono text-sm font-semibold text-foreground mb-2">Notifications</h3>
              <Toggle checked={settings.notifications} onChange={() => set("notifications", !settings.notifications)} label="Enable Notifications" />
              <Toggle checked={settings.emailNotifs} onChange={() => set("emailNotifs", !settings.emailNotifs)} label="Email Notifications" />
            </div>
          </div>
        );
      case "browser":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Browser Engine</h3>
              <div className="flex gap-2">
                {["chromium", "firefox", "webkit"].map(b => (
                  <button key={b} onClick={() => set("browser", b)}
                    className={`font-mono text-xs px-4 py-2 rounded-xl border transition-all capitalize ${
                      settings.browser === b ? "border-primary/40 bg-primary/10 text-primary" : "border-glass-border text-muted-foreground hover:text-foreground"
                    }`}
                  >{b}</button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Toggle checked={settings.headless} onChange={() => set("headless", !settings.headless)} label="Headless Mode" />
              <Slider value={settings.defaultTimeout} onChange={v => set("defaultTimeout", v)} min={5} max={60} label="Default Timeout" unit="s" />
              <Slider value={settings.slowMotion} onChange={v => set("slowMotion", v)} min={0} max={5000} label="Slow Motion Delay" unit="ms" />
            </div>
            <div className="border-t border-glass-border pt-4 space-y-3">
              <h3 className="font-mono text-sm font-semibold text-foreground mb-2">Screenshots & Video</h3>
              <Toggle checked={settings.autoScreenshot} onChange={() => set("autoScreenshot", !settings.autoScreenshot)} label="Auto-screenshot on Error" />
              <Toggle checked={settings.videoRecording} onChange={() => set("videoRecording", !settings.videoRecording)} label="Video Recording" />
            </div>
          </div>
        );
      case "network":
        return (
          <div className="space-y-3">
            <Toggle checked={settings.interceptAll} onChange={() => set("interceptAll", !settings.interceptAll)} label="Intercept All Requests" />
            <Toggle checked={settings.logConsole} onChange={() => set("logConsole", !settings.logConsole)} label="Log Console Messages" />
            <Toggle checked={settings.captureHeaders} onChange={() => set("captureHeaders", !settings.captureHeaders)} label="Capture Headers" />
            <Toggle checked={settings.captureBodies} onChange={() => set("captureBodies", !settings.captureBodies)} label="Capture Bodies" />
          </div>
        );
      case "ai":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-mono text-sm font-semibold text-foreground mb-4">Provider</h3>
              <div className="flex gap-2">
                {["groq", "openai", "anthropic"].map(p => (
                  <button key={p} onClick={() => set("aiProvider", p)}
                    className={`font-mono text-xs px-4 py-2 rounded-xl border transition-all capitalize ${
                      settings.aiProvider === p ? "border-primary/40 bg-primary/10 text-primary" : "border-glass-border text-muted-foreground hover:text-foreground"
                    }`}
                  >{p}</button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="font-mono text-xs text-muted-foreground block mb-1">API Key</span>
                <div className="flex gap-2">
                  <input type="password" defaultValue="gsk_••••••••••••••••" className="flex-1 bg-muted/20 border border-glass-border rounded-xl px-3 py-2 font-mono text-xs text-foreground outline-none" />
                  <button onClick={() => toast.info("API key connection test — configure DB first")} className="px-3 py-2 rounded-xl font-mono text-[10px] border border-primary/30 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1">
                    <TestTube className="w-3 h-3" /> Test
                  </button>
                </div>
              </div>
              <div>
                <span className="font-mono text-xs text-muted-foreground block mb-1">Model</span>
                <select value={settings.aiModel} onChange={(e) => set("aiModel", e.target.value)} className="w-full bg-muted/20 border border-glass-border rounded-xl px-3 py-2 font-mono text-xs text-foreground outline-none cursor-pointer">
                  <option className="bg-background" value="qwen2.5-coder-32b">qwen2.5-coder-32b-instruct</option>
                  <option className="bg-background" value="llama-3.3-70b">llama-3.3-70b-versatile</option>
                  <option className="bg-background" value="mixtral-8x7b">mixtral-8x7b-32768</option>
                </select>
              </div>
              <Slider value={settings.temperature} onChange={v => set("temperature", v)} min={0} max={100} label="Temperature" unit="%" />
              <Toggle checked={settings.streaming} onChange={() => set("streaming", !settings.streaming)} label="Enable Streaming" />
              <Toggle checked={settings.autoAnalyze} onChange={() => set("autoAnalyze", !settings.autoAnalyze)} label="Auto-analyze Errors" />
            </div>
          </div>
        );
      case "blueprints":
        return (
          <div className="space-y-3">
            <Toggle checked={settings.autoSave} onChange={() => set("autoSave", !settings.autoSave)} label="Auto-save Successful Flows" />
            <Toggle checked={settings.validateSelectors} onChange={() => set("validateSelectors", !settings.validateSelectors)} label="Validate Selectors" />
          </div>
        );
      case "reports":
        return (
          <div className="space-y-6">
            <div>
              <span className="font-mono text-xs text-muted-foreground block mb-1">Default Format</span>
              <div className="flex gap-2">
                {["json", "html", "markdown"].map(f => (
                  <button key={f} onClick={() => set("reportFormat", f)}
                    className={`font-mono text-xs px-4 py-2 rounded-xl border transition-all uppercase ${
                      settings.reportFormat === f ? "border-primary/40 bg-primary/10 text-primary" : "border-glass-border text-muted-foreground hover:text-foreground"
                    }`}
                  >{f}</button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Toggle checked={settings.autoExport} onChange={() => set("autoExport", !settings.autoExport)} label="Auto-export Reports" />
              <Slider value={settings.retentionDays} onChange={v => set("retentionDays", v)} min={7} max={365} label="Retention Period" unit=" days" />
            </div>
            <div className="border-t border-glass-border pt-4 space-y-3">
              <h3 className="font-mono text-sm font-semibold text-foreground mb-2">Include in Reports</h3>
              <Toggle checked={settings.includeScreenshots} onChange={() => set("includeScreenshots", !settings.includeScreenshots)} label="Screenshots" />
              <Toggle checked={settings.includeNetwork} onChange={() => set("includeNetwork", !settings.includeNetwork)} label="Network Logs" />
              <Toggle checked={settings.includeConsole} onChange={() => set("includeConsole", !settings.includeConsole)} label="Console Logs" />
            </div>
          </div>
        );
      case "secrets":
        return <SecretsSection />;
      case "cicd":
        return <CICDSection />;
      case "team":
        return <TeamSection />;
      case "integrations":
        return (
          <div className="space-y-4">
            {[
              { key: "slack", name: "Slack", desc: "Send notifications to Slack channels" },
              { key: "github", name: "GitHub Actions", desc: "CI/CD integration templates" },
              { key: "email", name: "Email (SMTP)", desc: "Send report emails via SMTP" },
              { key: "webhooks", name: "Webhooks", desc: "Custom webhook endpoints" },
            ].map((int) => (
              <div key={int.key} className="glass-panel-strong p-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-semibold text-foreground">{int.name}</span>
                  <p className="font-mono text-[10px] text-muted-foreground">{int.desc}</p>
                </div>
                <button
                  onClick={() => toggleIntegration(int.key)}
                  className={`font-mono text-[10px] px-3 py-1.5 rounded-lg border transition-colors ${
                    settings.integrations[int.key]
                      ? "border-emerald-400/30 text-emerald-400 bg-emerald-400/10"
                      : "border-glass-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                  }`}
                >
                  {settings.integrations[int.key] ? "✓ Connected" : "Connect"}
                </button>
              </div>
            ))}
          </div>
        );
      case "advanced":
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Slider value={settings.parallelExec} onChange={v => set("parallelExec", v)} min={1} max={10} label="Parallel Executions" unit="" />
              <Slider value={settings.maxRetries} onChange={v => set("maxRetries", v)} min={0} max={5} label="Max Retries" unit="" />
              <Toggle checked={settings.debugMode} onChange={() => set("debugMode", !settings.debugMode)} label="Debug Mode" />
            </div>
            <div className="border-t border-glass-border pt-4 space-y-3">
              <h3 className="font-mono text-sm font-semibold text-foreground text-destructive mb-2">Danger Zone</h3>
              <div className="flex gap-2">
                <button onClick={resetDefaults} className="font-mono text-[10px] px-3 py-2 rounded-xl border border-glass-border text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Reset to Defaults
                </button>
                <button onClick={clearAllData} className="font-mono text-[10px] px-3 py-2 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Clear All Data
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight gradient-text flex items-center gap-2" style={{ fontFamily: "'Sen', sans-serif" }}>
          <span>⚙️</span> Settings
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">Configure NPM system</p>
      </div>

      <div className="grid md:grid-cols-[200px_1fr] gap-6">
        <div className="glass-panel p-2 space-y-0.5 h-fit">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-mono text-xs transition-all ${
                activeSection === section.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border border-transparent"
              }`}
            >
              {section.icon}
              <span>{section.label}</span>
              <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
            </button>
          ))}
        </div>

        <GlassPanel glow="none" className="min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-mono text-sm font-semibold text-foreground uppercase tracking-wider">
              {SECTIONS.find(s => s.id === activeSection)?.label}
            </h2>
            <button
              onClick={saveSettings}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs border transition-colors ${
                dirty
                  ? "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30"
                  : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
              }`}
            >
              <Save className="w-3 h-3" /> {dirty ? "Save Changes *" : "Save Changes"}
            </button>
          </div>
          {renderSection()}
        </GlassPanel>
      </div>
    </div>
  );
};

export default Settings;

// ─────────────────────────────────────────────────────────────────────────────
// PART 2B: Secrets Section
// ─────────────────────────────────────────────────────────────────────────────
const SecretsSection = () => {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "credentials", domain: "", username: "", password: "", url: "" });

  useEffect(() => { loadSecrets(); }, []);
  const loadSecrets = async () => {
    setLoading(true);
    try { const r = await listSecrets(); setSecrets(r.secrets); } catch {}
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSecret({
        name: form.name, type: form.type, domain: form.domain || undefined,
        data: { username: form.username, password: form.password, url: form.url },
        tags: [],
      });
      toast.success("Secret stored securely!");
      setShowAdd(false);
      setForm({ name: "", type: "credentials", domain: "", username: "", password: "", url: "" });
      await loadSecrets();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save secret");
    }
  };

  const handleDelete = async (id: string) => {
    try { await deleteSecret(id); toast.success("Secret deleted"); await loadSecrets(); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-muted-foreground">Store credentials securely — passwords encrypted at rest, never exposed in reports.</p>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs border border-primary/30 text-primary hover:bg-primary/10">
          <Plus className="w-3 h-3" /> Add Secret
        </button>
      </div>
      {showAdd && (
        <form onSubmit={handleCreate} className="glass-panel-strong p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="font-mono text-[10px] text-muted-foreground mb-1 block">Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="My Amazon Account"
                className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40" /></div>
            <div><label className="font-mono text-[10px] text-muted-foreground mb-1 block">Domain</label>
              <input value={form.domain} onChange={e => setForm(f => ({...f, domain: e.target.value}))} placeholder="amazon.in"
                className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40" /></div>
            <div><label className="font-mono text-[10px] text-muted-foreground mb-1 block">Username / Email</label>
              <input value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} placeholder="user@example.com"
                className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40" /></div>
            <div><label className="font-mono text-[10px] text-muted-foreground mb-1 block">Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="••••••••"
                className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40" /></div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-xl font-mono text-[10px] border border-glass-border text-muted-foreground">Cancel</button>
            <button type="submit" className="px-3 py-1.5 rounded-xl font-mono text-[10px] bg-primary/20 border border-primary/30 text-primary">Save Encrypted</button>
          </div>
        </form>
      )}
      {loading ? <div className="font-mono text-xs text-muted-foreground">Loading...</div> : (
        <div className="space-y-2">
          {secrets.length === 0 && <div className="font-mono text-xs text-muted-foreground py-6 text-center">No secrets stored yet.</div>}
          {secrets.map(s => (
            <div key={s.secret_id} className="glass-panel-strong p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono text-xs font-semibold text-foreground">{s.name}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground">{s.type}</span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  {s.domain && <span>Domain: {s.domain} · </span>}
                  {s.data.username && <span>User: {s.data.username} · </span>}
                  <span>Password: ***masked***</span>
                </div>
              </div>
              <button onClick={() => handleDelete(s.secret_id)} className="p-1.5 rounded-lg text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PART 5C: CI/CD Integration Section
// ─────────────────────────────────────────────────────────────────────────────
const CICDSection = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", blueprint_id: "", branch_filter: "" });
  const BACKEND_URL = (import.meta.env.REACT_APP_BACKEND_URL as string || "").replace(/\/$/, "");

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try {
      const [w, b] = await Promise.all([listWebhooks(), listBlueprints()]);
      setWebhooks(w.webhooks); setBlueprints(b.blueprints);
    } catch {}
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await createWebhook({ name: form.name, blueprint_id: form.blueprint_id, branch_filter: form.branch_filter || undefined });
      setNewWebhookSecret(r.secret_token);
      toast.success("Webhook created! Save the secret token.");
      setForm({ name: "", blueprint_id: "", branch_filter: "" });
      setShowAdd(false);
      await load();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteWebhook(id); toast.success("Webhook deleted"); await load(); }
    catch { toast.error("Delete failed"); }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  return (
    <div className="space-y-4">
      {newWebhookSecret && (
        <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/30">
          <p className="font-mono text-xs text-amber-400 mb-1">⚠ Save this token now — it won't be shown again!</p>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs text-foreground/80 flex-1 truncate">{newWebhookSecret}</code>
            <button onClick={() => copyText(newWebhookSecret)} className="p-1.5 rounded border border-amber-400/30 text-amber-400 hover:bg-amber-400/20">
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-muted-foreground">Register webhooks to trigger blueprint runs from GitHub/GitLab CI pipelines.</p>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs border border-primary/30 text-primary hover:bg-primary/10">
          <Plus className="w-3 h-3" /> Add Webhook
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="glass-panel-strong p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="font-mono text-[10px] text-muted-foreground mb-1 block">Webhook Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="On PR Merge: Smoke Tests"
                className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40" /></div>
            <div><label className="font-mono text-[10px] text-muted-foreground mb-1 block">Blueprint *</label>
              <select required value={form.blueprint_id} onChange={e => setForm(f => ({...f, blueprint_id: e.target.value}))}
                className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40">
                <option value="">Select...</option>
                {blueprints.map(b => <option key={b.blueprint_id} value={b.blueprint_id}>{b.name}</option>)}
              </select></div>
            <div><label className="font-mono text-[10px] text-muted-foreground mb-1 block">Branch Filter</label>
              <input value={form.branch_filter} onChange={e => setForm(f => ({...f, branch_filter: e.target.value}))} placeholder="main"
                className="w-full font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40" /></div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-xl font-mono text-[10px] border border-glass-border text-muted-foreground">Cancel</button>
            <button type="submit" className="px-3 py-1.5 rounded-xl font-mono text-[10px] bg-primary/20 border border-primary/30 text-primary">Create Webhook</button>
          </div>
        </form>
      )}

      {loading ? <div className="font-mono text-xs text-muted-foreground">Loading...</div> : (
        <div className="space-y-3">
          {webhooks.length === 0 && <div className="font-mono text-xs text-muted-foreground py-6 text-center">No webhooks yet.</div>}
          {webhooks.map(w => {
            const triggerUrl = `${BACKEND_URL}/api/webhooks/trigger/${w.webhook_id}`;
            const yamlSnippet = `- name: Run NPM Tests\n  run: |\n    curl -X POST ${triggerUrl} \\\n      -H "X-Webhook-Secret: YOUR_SECRET"`;
            return (
              <div key={w.webhook_id} className="glass-panel-strong p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-semibold text-foreground">{w.name}</span>
                    <div className="font-mono text-[10px] text-muted-foreground">Blueprint: {w.blueprint_name} · Triggers: {w.trigger_count}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowSecret(showSecret === w.webhook_id ? null : w.webhook_id)} className="p-1.5 rounded border border-glass-border text-muted-foreground hover:text-foreground">
                      {showSecret === w.webhook_id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    <button onClick={() => handleDelete(w.webhook_id)} className="p-1.5 rounded border border-destructive/20 text-destructive/50 hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {showSecret === w.webhook_id && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-[10px] text-muted-foreground flex-1 truncate">Token: {w.secret_token_preview}</code>
                      <button onClick={() => copyText(triggerUrl)} className="font-mono text-[10px] flex items-center gap-1 px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10">
                        <Copy className="w-2.5 h-2.5" /> Copy URL
                      </button>
                    </div>
                    <div className="relative">
                      <pre className="font-mono text-[9px] text-muted-foreground bg-muted/10 rounded-lg p-3 overflow-x-auto">{yamlSnippet}</pre>
                      <button onClick={() => copyText(yamlSnippet)} className="absolute top-1 right-1 p-1 rounded border border-glass-border text-muted-foreground hover:text-foreground">
                        <Copy className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <p className="font-mono text-[9px] text-muted-foreground">CLI: <code>python npm_cli.py run --blueprint {w.blueprint_id} --wait --server {BACKEND_URL}</code></p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PART 4C: Team & Workspace Section
// ─────────────────────────────────────────────────────────────────────────────
const TeamSection = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [wsName, setWsName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try {
      const r = await listWorkspaces();
      setWorkspaces(r.workspaces);
      if (r.workspaces.length > 0) setActiveWs(r.workspaces[0]);
    } catch {}
    setLoading(false);
  };

  const handleCreateWs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWorkspace({ name: wsName });
      toast.success("Workspace created!");
      setShowCreate(false); setWsName("");
      await load();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWs) return;
    try {
      await inviteMember(activeWs.workspace_id, { email: inviteEmail, role: inviteRole });
      toast.success(`Invited ${inviteEmail} as ${inviteRole}`);
      setInviteEmail("");
      await load();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const roleColor = (role: string) => role === "admin" ? "text-destructive" : role === "editor" ? "text-primary" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      {loading ? <div className="font-mono text-xs text-muted-foreground">Loading...</div> : (
        <>
          {workspaces.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Users className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="font-mono text-xs text-muted-foreground">No workspaces yet.</p>
              <button onClick={() => setShowCreate(true)} className="mx-auto flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border border-primary/30 text-primary hover:bg-primary/10">
                <Plus className="w-3 h-3" /> Create Workspace
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {workspaces.map(ws => (
                    <button key={ws.workspace_id} onClick={() => setActiveWs(ws)}
                      className={`font-mono text-xs px-3 py-1.5 rounded-xl border transition-colors ${activeWs?.workspace_id === ws.workspace_id ? "border-primary/40 bg-primary/10 text-primary" : "border-glass-border text-muted-foreground hover:text-foreground"}`}>
                      {ws.name}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 font-mono text-[10px] px-2 py-1.5 rounded-xl border border-glass-border text-muted-foreground hover:text-foreground">
                  <Plus className="w-3 h-3" /> New
                </button>
              </div>

              {activeWs && (
                <div className="space-y-3">
                  <form onSubmit={handleInvite} className="glass-panel-strong p-3 flex items-center gap-2">
                    <input required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@example.com"
                      className="flex-1 font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40" />
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                      className="font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-2 py-2 text-foreground/80 focus:outline-none">
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="px-3 py-2 rounded-xl font-mono text-[10px] bg-primary/20 border border-primary/30 text-primary whitespace-nowrap">Invite</button>
                  </form>

                  <div className="space-y-1">
                    {activeWs.members.length === 0 && <div className="font-mono text-xs text-muted-foreground py-4 text-center">No members yet — invite someone!</div>}
                    {activeWs.members.map(m => (
                      <div key={m.user_id} className="glass-panel-strong p-3 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs text-foreground/80">{m.name || m.email}</span>
                          <div className="font-mono text-[10px] text-muted-foreground">{m.email}</div>
                        </div>
                        <span className={`font-mono text-[10px] font-bold uppercase ${roleColor(m.role)}`}>{m.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {showCreate && (
            <form onSubmit={handleCreateWs} className="glass-panel-strong p-3 flex items-center gap-2">
              <input required value={wsName} onChange={e => setWsName(e.target.value)} placeholder="Team name..."
                className="flex-1 font-mono text-xs bg-muted/10 border border-glass-border rounded-lg px-3 py-2 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/40" />
              <button type="submit" className="px-3 py-2 rounded-xl font-mono text-[10px] bg-primary/20 border border-primary/30 text-primary">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-2 rounded-xl font-mono text-[10px] border border-glass-border text-muted-foreground">Cancel</button>
            </form>
          )}
        </>
      )}
    </div>
  );
};
