import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { ActionBadge, ActionType } from "@/components/ActionBadge";
import { toast } from "sonner";
import {
  Search, Plus, Upload, Grid3X3, List, Play, Copy, Trash2,
  Edit, Eye, MoreHorizontal, Filter
} from "lucide-react";

interface Blueprint {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
  successRate: number;
  timesUsed: number;
  avgDuration: string;
  lastUsed: string;
  actions: { type: ActionType; target: string }[];
  variables: string[];
}

const INITIAL_BLUEPRINTS: Blueprint[] = [
  {
    id: "signup_flow_v1", name: "Signup Flow", description: "Complete user registration with email, password, country selection, and terms acceptance.",
    version: "v1.2", tags: ["Authentication", "Forms"], successRate: 94, timesUsed: 47, avgDuration: "6.5s", lastUsed: "2m ago",
    actions: [
      { type: "navigate", target: "/signup" }, { type: "fill", target: "input#email" },
      { type: "fill", target: "input#password" }, { type: "select", target: "dropdown#country" },
      { type: "click", target: "#terms-checkbox" }, { type: "click", target: "button#submit" },
      { type: "wait", target: "**/dashboard**" }
    ],
    variables: ["USER_EMAIL", "PASSWORD", "COUNTRY"]
  },
  {
    id: "login_flow_v1", name: "Login Flow", description: "Standard login with email and password, verify dashboard redirect.",
    version: "v1.0", tags: ["Authentication"], successRate: 98, timesUsed: 82, avgDuration: "2.1s", lastUsed: "8m ago",
    actions: [
      { type: "navigate", target: "/login" }, { type: "fill", target: "input#email" },
      { type: "fill", target: "input#password" }, { type: "click", target: "button#login" },
      { type: "wait", target: "**/dashboard**" }
    ],
    variables: ["USER_EMAIL", "PASSWORD"]
  },
  {
    id: "checkout_flow_v1", name: "Checkout Flow", description: "E-commerce checkout with cart review, payment form, and order confirmation.",
    version: "v2.0", tags: ["E-commerce", "Forms"], successRate: 78, timesUsed: 23, avgDuration: "8.3s", lastUsed: "1h ago",
    actions: [
      { type: "navigate", target: "/cart" }, { type: "click", target: "button#checkout" },
      { type: "fill", target: "input#card-number" }, { type: "click", target: "button#pay" },
      { type: "wait", target: "**/confirmation**" }
    ],
    variables: ["CARD_NUMBER", "CARD_EXPIRY", "CARD_CVC"]
  },
  {
    id: "profile_update_v1", name: "Profile Update", description: "Update user profile including name, bio, and avatar upload.",
    version: "v1.1", tags: ["Forms", "Navigation"], successRate: 85, timesUsed: 15, avgDuration: "5.1s", lastUsed: "3h ago",
    actions: [
      { type: "navigate", target: "/settings/profile" }, { type: "fill", target: "input#name" },
      { type: "fill", target: "textarea#bio" }, { type: "click", target: "button#save" },
      { type: "assert", target: ".success-toast" }
    ],
    variables: ["USER_NAME", "USER_BIO"]
  },
  {
    id: "search_test_v1", name: "Search & Filter", description: "Test search functionality with various queries and filter combinations.",
    version: "v1.0", tags: ["Navigation", "Custom"], successRate: 91, timesUsed: 31, avgDuration: "4.2s", lastUsed: "6h ago",
    actions: [
      { type: "navigate", target: "/products" }, { type: "fill", target: "input#search" },
      { type: "click", target: ".filter-category" }, { type: "assert", target: ".product-card" }
    ],
    variables: ["SEARCH_QUERY"]
  },
  {
    id: "onboarding_flow_v1", name: "Onboarding Flow", description: "Multi-step onboarding wizard with preferences, team setup, and tutorial completion.",
    version: "v1.3", tags: ["Forms", "Navigation"], successRate: 88, timesUsed: 12, avgDuration: "12.4s", lastUsed: "1d ago",
    actions: [
      { type: "navigate", target: "/onboarding" }, { type: "click", target: ".preference-card" },
      { type: "fill", target: "input#team-name" }, { type: "click", target: "button#next" },
      { type: "click", target: "button#complete" }, { type: "wait", target: "**/dashboard**" }
    ],
    variables: ["TEAM_NAME", "PREFERENCES"]
  },
];

const ALL_TAGS = ["Authentication", "Forms", "E-commerce", "Navigation", "Custom"];

const Blueprints = () => {
  const navigate = useNavigate();
  const [blueprints, setBlueprints] = useState<Blueprint[]>(INITIAL_BLUEPRINTS);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"recent" | "name" | "rate" | "usage">("recent");

  const filtered = blueprints
    .filter(bp => {
      const matchSearch = !search || bp.name.toLowerCase().includes(search.toLowerCase()) || bp.description.toLowerCase().includes(search.toLowerCase());
      const matchTags = selectedTags.length === 0 || selectedTags.some(t => bp.tags.includes(t));
      return matchSearch && matchTags;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "rate") return b.successRate - a.successRate;
      if (sortBy === "usage") return b.timesUsed - a.timesUsed;
      return 0;
    });

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const runBlueprint = useCallback((bp: Blueprint) => {
    toast.success(`Running "${bp.name}"...`);
    navigate("/execute");
  }, [navigate]);

  const duplicateBlueprint = useCallback((bp: Blueprint) => {
    const clone: Blueprint = { ...bp, id: `${bp.id}_copy_${Date.now()}`, name: `${bp.name} (Copy)`, timesUsed: 0 };
    setBlueprints(prev => [...prev, clone]);
    toast.success(`Duplicated "${bp.name}"`);
  }, []);

  const deleteBlueprint = useCallback((bp: Blueprint) => {
    setBlueprints(prev => prev.filter(b => b.id !== bp.id));
    toast.success(`Deleted "${bp.name}"`);
  }, []);

  const importBlueprint = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.name && data.actions) {
            const newBp: Blueprint = {
              id: `imported_${Date.now()}`,
              name: data.name || "Imported Blueprint",
              description: data.description || "",
              version: data.version || "v1.0",
              tags: data.tags || ["Custom"],
              successRate: 0,
              timesUsed: 0,
              avgDuration: "—",
              lastUsed: "Never",
              actions: data.actions || [],
              variables: data.variables || [],
            };
            setBlueprints(prev => [...prev, newBp]);
            toast.success(`Imported "${newBp.name}"`);
          } else {
            toast.error("Invalid blueprint file format");
          }
        } catch {
          toast.error("Failed to parse JSON file");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground/60 flex items-center gap-2" style={{ fontFamily: "'Sen', sans-serif" }}>
            <span>📐</span> Blueprints
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">{blueprints.length} crystallized patterns</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/blueprints/create"
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Blueprint
          </Link>
          <button
            onClick={importBlueprint}
            className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-md glass-panel-strong flex items-center gap-2 px-3 py-2 rounded-xl">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blueprints..."
            className="flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        <div className="flex items-center gap-1 border border-glass-border rounded-xl overflow-hidden">
          <button
            onClick={() => setView("grid")}
            className={`p-2 transition-colors ${view === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-2 transition-colors ${view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="glass-panel-strong px-3 py-2 rounded-xl font-mono text-xs text-foreground bg-transparent border-none outline-none cursor-pointer"
        >
          <option value="recent" className="bg-background">Recent</option>
          <option value="name" className="bg-background">Name</option>
          <option value="rate" className="bg-background">Success Rate</option>
          <option value="usage" className="bg-background">Most Used</option>
        </select>
      </div>

      {/* Tags filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {ALL_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`font-mono text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
              selectedTags.includes(tag)
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-glass-border text-muted-foreground hover:text-foreground hover:border-primary/20"
            }`}
          >
            {tag}
          </button>
        ))}
        {selectedTags.length > 0 && (
          <button
            onClick={() => setSelectedTags([])}
            className="font-mono text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Grid View */}
      {view === "grid" ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((bp, i) => (
            <motion.div
              key={bp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -6, boxShadow: "0 8px 30px -8px hsl(var(--primary) / 0.15), 0 4px 16px -4px hsl(0 0% 0% / 0.1)", transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] } }}
              className="glass-panel p-5 space-y-3 group cursor-pointer"
              style={{ transition: "transform 0.45s cubic-bezier(0.25,0.1,0.25,1), box-shadow 0.45s cubic-bezier(0.25,0.1,0.25,1)" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-mono text-sm font-semibold text-foreground">{bp.name}</h3>
                  <span className="font-mono text-[9px] text-secondary">{bp.version}</span>
                </div>
              </div>

              <p className="font-mono text-[11px] text-muted-foreground line-clamp-2">{bp.description}</p>

              <div className="flex flex-wrap gap-1">
                {bp.tags.map(tag => (
                  <span key={tag} className="font-mono text-[9px] px-2 py-0.5 rounded border border-glass-border text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-glass-border">
                <div className="text-center">
                  <div className={`font-mono text-sm font-bold ${bp.successRate >= 90 ? "text-emerald-400" : bp.successRate >= 70 ? "text-amber-400" : "text-destructive"}`}>
                    {bp.successRate}%
                  </div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Rate</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-sm font-bold text-primary">{bp.timesUsed}</div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Used</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-sm font-bold text-muted-foreground">{bp.avgDuration}</div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Avg</div>
                </div>
              </div>

              <div className="font-mono text-[9px] text-muted-foreground">Last used: {bp.lastUsed}</div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => runBlueprint(bp)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono text-[10px] bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                >
                  <Play className="w-3 h-3" /> Run
                </button>
                <Link to={`/blueprints/${bp.id}/view`} className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-foreground transition-colors" title="View">
                  <Eye className="w-3 h-3" />
                </Link>
                <Link to={`/blueprints/${bp.id}/edit`} className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                  <Edit className="w-3 h-3" />
                </Link>
                <button onClick={() => duplicateBlueprint(bp)} className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
                  <Copy className="w-3 h-3" />
                </button>
                <button onClick={() => deleteBlueprint(bp)} className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <GlassPanel glow="none">
          <div className="grid grid-cols-[1fr_150px_80px_80px_80px_100px] gap-3 px-3 py-2 font-mono text-[9px] text-muted-foreground uppercase tracking-wider border-b border-glass-border">
            <span>Name</span>
            <span>Tags</span>
            <span>Rate</span>
            <span>Used</span>
            <span>Avg</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-glass-border/50">
            {filtered.map((bp) => (
              <div key={bp.id} className="grid grid-cols-[1fr_150px_80px_80px_80px_100px] gap-3 px-3 py-3 items-center hover:bg-muted/10 transition-colors">
                <div>
                  <span className="font-mono text-xs text-foreground">{bp.name}</span>
                  <span className="font-mono text-[9px] text-secondary ml-2">{bp.version}</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {bp.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="font-mono text-[8px] px-1.5 py-0.5 rounded border border-glass-border text-muted-foreground">{tag}</span>
                  ))}
                </div>
                <span className={`font-mono text-xs font-bold ${bp.successRate >= 90 ? "text-emerald-400" : "text-amber-400"}`}>{bp.successRate}%</span>
                <span className="font-mono text-xs text-primary">{bp.timesUsed}</span>
                <span className="font-mono text-xs text-muted-foreground">{bp.avgDuration}</span>
                <div className="flex gap-1">
                  <button onClick={() => runBlueprint(bp)} className="p-1 rounded text-primary hover:bg-primary/10"><Play className="w-3 h-3" /></button>
                  <Link to={`/blueprints/${bp.id}/view`} className="p-1 rounded text-muted-foreground hover:text-foreground"><Eye className="w-3 h-3" /></Link>
                  <Link to={`/blueprints/${bp.id}/edit`} className="p-1 rounded text-muted-foreground hover:text-foreground"><Edit className="w-3 h-3" /></Link>
                  <button onClick={() => deleteBlueprint(bp)} className="p-1 rounded text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
};

export default Blueprints;
