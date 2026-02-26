import { useState, useEffect } from "react";
import { GlassPanel } from "@/components/GlassPanel";
import { Save, Trash2, Plus, Eye, EyeOff, ChevronDown, ChevronUp, X, Pencil } from "lucide-react";
import { AnimatedAvatar, AVATAR_ANIMALS, AvatarAnimal, getAvatarLabel } from "@/components/AnimatedAvatar";
import { motion, AnimatePresence } from "framer-motion";

interface Secret {
  id: string;
  testEnv: string;
  releaseBranch: string;
  url: string;
  username: string;
  password: string;
  createdAt: string;
}

const Profile = () => {
  const [name, setName] = useState(() => localStorage.getItem("npm_display_name") || "QA Admin");
  const [email] = useState("qa_admin@npmmonitor.dev");
  const [bio, setBio] = useState(() => localStorage.getItem("npm_bio") || "Senior QA Engineer. Automating everything through liquid glass.");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarAnimal>(() => {
    return (localStorage.getItem("npm_avatar") as AvatarAnimal) || "lion";
  });

  useEffect(() => {
    localStorage.setItem("npm_avatar", selectedAvatar);
    window.dispatchEvent(new CustomEvent("avatar-changed", { detail: selectedAvatar }));
  }, [selectedAvatar]);

  const [secrets, setSecrets] = useState<Secret[]>(() => {
    try {
      const stored = localStorage.getItem("npm_secrets");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState({ testEnv: "", releaseBranch: "", url: "", username: "", password: "" });

  useEffect(() => {
    localStorage.setItem("npm_secrets", JSON.stringify(secrets));
  }, [secrets]);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddSecret = () => {
    if (!newSecret.testEnv.trim() || !newSecret.url.trim()) return;
    const secret: Secret = {
      id: crypto.randomUUID(),
      ...newSecret,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setSecrets(prev => [...prev, secret]);
    setNewSecret({ testEnv: "", releaseBranch: "", url: "", username: "", password: "" });
    setShowAddForm(false);
    setExpandedId(secret.id);
  };

  const handleEditSecret = (secret: Secret) => {
    setNewSecret({ testEnv: secret.testEnv, releaseBranch: secret.releaseBranch, url: secret.url, username: secret.username, password: secret.password });
    setEditingId(secret.id);
    setShowAddForm(true);
    setExpandedId(null);
  };

  const handleSaveSecret = () => {
    if (!newSecret.testEnv.trim() || !newSecret.url.trim()) return;
    if (editingId) {
      setSecrets(prev => prev.map(s => s.id === editingId ? { ...s, ...newSecret } : s));
      setEditingId(null);
    } else {
      const secret: Secret = { id: crypto.randomUUID(), ...newSecret, createdAt: new Date().toISOString().split("T")[0] };
      setSecrets(prev => [...prev, secret]);
      setExpandedId(secret.id);
    }
    setNewSecret({ testEnv: "", releaseBranch: "", url: "", username: "", password: "" });
    setShowAddForm(false);
  };

  const inputClass = "w-full bg-muted/20 border border-glass-border rounded-xl px-3 py-2 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50";
  const labelClass = "font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight gradient-text flex items-center gap-2" style={{ fontFamily: "'Sen', sans-serif" }}>
          <span>👤</span> Profile
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">Account management</p>
      </div>

      {/* Avatar Selection */}
      <GlassPanel title="Choose Avatar" icon="✨" glow="purple">
        <div className="flex flex-wrap items-center gap-4">
          {AVATAR_ANIMALS.map((animal) => (
            <div key={animal} className="flex flex-col items-center gap-1.5">
              <AnimatedAvatar
                animal={animal}
                size="md"
                selected={selectedAvatar === animal}
                onClick={() => setSelectedAvatar(animal)}
              />
              <span className={`font-mono text-[9px] ${selectedAvatar === animal ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                {getAvatarLabel(animal)}
              </span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Profile Card */}
      <GlassPanel glow="cyan">
        <div className="flex items-start gap-6">
          <AnimatedAvatar animal={selectedAvatar} size="lg" />
          <div className="flex-1 space-y-3">
            <div>
              <label className={labelClass}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-muted/20 border border-glass-border rounded-xl px-3 py-2 font-mono text-base text-foreground outline-none focus:ring-1 focus:ring-primary/40" />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input value={email} readOnly className="w-full bg-muted/10 border border-glass-border rounded-xl px-3 py-2 font-mono text-sm text-muted-foreground outline-none cursor-not-allowed" />
            </div>
            <div>
              <label className={labelClass}>Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="w-full bg-muted/20 border border-glass-border rounded-xl px-3 py-2 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40 resize-none" />
            </div>
            <button
              onClick={() => {
                localStorage.setItem("npm_display_name", name);
                localStorage.setItem("npm_bio", bio);
                window.dispatchEvent(new CustomEvent("profile-updated", { detail: { name, bio } }));
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
            >
              <Save className="w-3 h-3" /> Save Changes
            </button>
          </div>
        </div>
      </GlassPanel>

      {/* Member Since */}
      <GlassPanel title="Member Since" icon="📅" glow="purple">
        <p className="font-mono text-sm text-muted-foreground">January 2026</p>
      </GlassPanel>

      {/* Secrets */}
      <GlassPanel title="Secrets" icon="🔑" glow="none">
        <div className="space-y-3">
          {secrets.map((secret) => {
            const isExpanded = expandedId === secret.id;
            const pwVisible = visiblePasswords.has(secret.id);
            return (
              <div key={secret.id} className="glass-panel-strong rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : secret.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left group"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="font-mono text-[11px] font-semibold text-foreground truncate flex-1">{secret.testEnv}</span>
                  {secret.releaseBranch && (
                    <span className="font-mono text-[8px] px-1.5 py-px rounded-md bg-primary/10 text-primary border border-primary/15 shrink-0">
                      {secret.releaseBranch}
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-1.5 border-t border-glass-border/50">
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[10px] font-mono">
                          <span className="text-muted-foreground uppercase tracking-wider">url</span>
                          <span className="text-foreground truncate">{secret.url}</span>
                          <span className="text-muted-foreground uppercase tracking-wider">user</span>
                          <span className="text-foreground">{secret.username || "—"}</span>
                          <span className="text-muted-foreground uppercase tracking-wider">pass</span>
                          <span className="text-foreground flex items-center gap-1.5">
                            {pwVisible ? "••••••••" : secret.password}
                            <button onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(secret.id); }} className="text-muted-foreground hover:text-foreground transition-colors">
                              {pwVisible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                            </button>
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-glass-border/30">
                          <span className="font-mono text-[8px] text-muted-foreground/60">{secret.createdAt}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditSecret(secret)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[9px] text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Pencil className="w-2.5 h-2.5" /> Edit
                            </button>
                            <button
                              onClick={() => setSecrets(s => s.filter(x => x.id !== secret.id))}
                              className="flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[9px] text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="w-2.5 h-2.5" /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Add New Secret Form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-panel-strong rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-semibold text-foreground">{editingId ? "Edit Secret" : "New Secret"}</span>
                    <button onClick={() => { setShowAddForm(false); setEditingId(null); setNewSecret({ testEnv: "", releaseBranch: "", url: "", username: "", password: "" }); }} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Test Environment *</label>
                      <input
                        value={newSecret.testEnv}
                        onChange={(e) => setNewSecret(s => ({ ...s, testEnv: e.target.value }))}
                        placeholder="e.g. Staging, QA, UAT"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Release Branch</label>
                      <input
                        value={newSecret.releaseBranch}
                        onChange={(e) => setNewSecret(s => ({ ...s, releaseBranch: e.target.value }))}
                        placeholder="e.g. release/2.4"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>URL *</label>
                    <input
                      value={newSecret.url}
                      onChange={(e) => setNewSecret(s => ({ ...s, url: e.target.value }))}
                      placeholder="https://staging.example.com"
                      className={inputClass}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Username</label>
                      <input
                        value={newSecret.username}
                        onChange={(e) => setNewSecret(s => ({ ...s, username: e.target.value }))}
                        placeholder="qa_user"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Password</label>
                      <input
                        type="password"
                        value={newSecret.password}
                        onChange={(e) => setNewSecret(s => ({ ...s, password: e.target.value }))}
                        placeholder="••••••••"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveSecret}
                    disabled={!newSecret.testEnv.trim() || !newSecret.url.trim()}
                    className="w-full py-2.5 rounded-xl font-mono text-xs font-semibold bg-foreground text-background hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {editingId ? "Update Secret" : "Save Secret"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-xs border border-dashed border-glass-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Secret
            </button>
          )}
        </div>
      </GlassPanel>
    </div>
  );
};

export default Profile;
