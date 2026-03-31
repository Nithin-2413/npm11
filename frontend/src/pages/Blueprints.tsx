import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { ActionBadge, ActionType } from "@/components/ActionBadge";
import { toast } from "sonner";
import {
  Search, Plus, Grid3X3, List, Play, Copy, Trash2,
  Edit, Eye, Loader2, RefreshCw
} from "lucide-react";
import {
  listBlueprints, deleteBlueprint as apiBlueprintDelete,
  duplicateBlueprint as apiBlueprintDuplicate, executeBlueprint,
  Blueprint
} from "@/lib/api";

const ALL_TAGS = ["Authentication", "Forms", "E-commerce", "Navigation", "Custom", "Search", "Validation"];

const Blueprints = () => {
  const navigate = useNavigate();
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"recent" | "name" | "usage">("recent");
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);

  const fetchBlueprints = async () => {
    setLoading(true);
    try {
      const data = await listBlueprints({ search: search || undefined, sort: sortBy, page_size: 50 });
      setBlueprints(data.blueprints);
    } catch {
      toast.error("Failed to load blueprints");
    } finally {
      setLoading(false);
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch blueprints on mount and when sortBy changes
  useEffect(() => {
    fetchBlueprints();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, sortBy]);

  const filtered = blueprints.filter(bp => {
    const matchSearch = !search || bp.name.toLowerCase().includes(search.toLowerCase()) || bp.description.toLowerCase().includes(search.toLowerCase());
    const matchTags = selectedTags.length === 0 || selectedTags.some(t => bp.metadata?.tags?.includes(t));
    return matchSearch && matchTags;
  });

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleRun = async (bp: Blueprint) => {
    setRunningId(bp.blueprint_id);
    try {
      const res = await executeBlueprint(bp.blueprint_id, {});
      toast.success(`Blueprint "${bp.name}" started`);
      navigate(`/execute`, { state: { executionId: res.execution_id } });
    } catch (err) {
      toast.error(`Failed to run blueprint`);
    } finally {
      setRunningId(null);
    }
  };

  const handleDuplicate = async (bp: Blueprint) => {
    try {
      const res = await apiBlueprintDuplicate(bp.blueprint_id);
      toast.success(`Duplicated "${bp.name}"`);
      fetchBlueprints();
    } catch {
      toast.error("Duplicate failed");
    }
  };

  const handleDelete = async (bp: Blueprint) => {
    try {
      await apiBlueprintDelete(bp.blueprint_id);
      setBlueprints(prev => prev.filter(b => b.blueprint_id !== bp.blueprint_id));
      toast.success(`Deleted "${bp.name}"`);
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Sen', sans-serif" }}>
            <span className="text-foreground/60">Blueprint</span> <span className="gradient-text">Library</span>
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {blueprints.length} automation blueprints
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchBlueprints} className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            to="/blueprints/create"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl font-mono text-xs font-semibold text-primary border border-primary/30 hover:border-primary/50 transition-all"
            style={{ background: "hsl(var(--glass-bg) / 0.25)", backdropFilter: "blur(24px)" }}
          >
            <Plus className="w-3.5 h-3.5" /> New Blueprint
          </Link>
          <div className="flex items-center border border-glass-border rounded-xl overflow-hidden">
            {(["grid", "list"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-2 transition-colors ${view === v ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v === "grid" ? <Grid3X3 className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm glass-panel-strong flex items-center gap-2 px-3 py-2 rounded-xl">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchBlueprints()}
            placeholder="Search blueprints..."
            className="flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {ALL_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`font-mono text-[10px] px-2.5 py-1 rounded-lg border transition-all ${selectedTags.includes(tag) ? "border-secondary/40 bg-secondary/10 text-secondary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {tag}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="glass-panel-strong px-3 py-2 rounded-xl font-mono text-xs text-foreground bg-transparent outline-none cursor-pointer"
        >
          <option className="bg-background" value="recent">Recently Updated</option>
          <option className="bg-background" value="name">Name A-Z</option>
          <option className="bg-background" value="usage">Most Used</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <GlassPanel glow="none">
          <div className="text-center py-12 font-mono text-sm text-muted-foreground">
            <div className="text-4xl mb-4">📐</div>
            No blueprints found. Create your first blueprint!
          </div>
        </GlassPanel>
      )}

      {/* Grid View */}
      {!loading && view === "grid" && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((bp, i) => (
            <motion.div
              key={bp.blueprint_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass-panel p-5 flex flex-col gap-3 group cursor-pointer hover:bg-muted/5 transition-all"
              onClick={() => navigate(`/blueprints/${bp.blueprint_id}/edit`)}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-mono text-sm font-bold text-foreground truncate">{bp.name}</h3>
                  <p className="font-mono text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{bp.description}</p>
                </div>
                <span className="font-mono text-[9px] text-muted-foreground border border-glass-border px-1.5 py-0.5 rounded shrink-0">v{bp.version}</span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {(bp.metadata?.tags || []).slice(0, 3).map(tag => (
                  <span key={tag} className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-secondary/20 text-secondary/70 bg-secondary/5">{tag}</span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="font-mono text-sm font-bold text-emerald-400">
                    {(bp.metadata?.success_rate * 100 || 0).toFixed(0)}%
                  </div>
                  <div className="font-mono text-[8px] text-muted-foreground">Success</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-sm font-bold text-primary">{bp.metadata?.usage_count || 0}</div>
                  <div className="font-mono text-[8px] text-muted-foreground">Runs</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-sm font-bold text-foreground/60">{bp.actions?.length || 0}</div>
                  <div className="font-mono text-[8px] text-muted-foreground">Actions</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-sm font-bold text-secondary/70">{bp.variables?.length || 0}</div>
                  <div className="font-mono text-[8px] text-muted-foreground">Vars</div>
                </div>
              </div>

              {/* Action steps preview */}
              <div className="flex flex-wrap gap-1">
                {(bp.actions || []).slice(0, 5).map((action, j) => (
                  <ActionBadge key={j} type={action.type as ActionType} />
                ))}
                {(bp.actions?.length || 0) > 5 && (
                  <span className="font-mono text-[9px] text-muted-foreground px-1.5 py-0.5 rounded-full border border-glass-border">
                    +{bp.actions.length - 5}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-glass-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleRun(bp); }}
                  disabled={runningId === bp.blueprint_id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-mono text-[10px] disabled:opacity-50"
                >
                  {runningId === bp.blueprint_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Run
                </button>
                <Link to={`/blueprints/${bp.blueprint_id}/edit`} onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                  <Edit className="w-3.5 h-3.5" />
                </Link>
                <button onClick={(e) => { e.stopPropagation(); handleDuplicate(bp); }}
                  className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-secondary hover:border-secondary/30 transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(bp); }}
                  className="ml-auto p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && view === "list" && (
        <div className="space-y-2">
          {filtered.map((bp, i) => (
            <motion.div
              key={bp.blueprint_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-panel p-4 flex items-center gap-4 hover:bg-muted/5 transition-all group cursor-pointer"
              onClick={() => navigate(`/blueprints/${bp.blueprint_id}/edit`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground">{bp.name}</span>
                  <span className="font-mono text-[9px] text-muted-foreground border border-glass-border px-1.5 py-0.5 rounded">v{bp.version}</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">{bp.description}</p>
              </div>
              <div className="flex items-center gap-4 text-center shrink-0">
                <div>
                  <div className="font-mono text-xs font-bold text-emerald-400">{(bp.metadata?.success_rate * 100 || 0).toFixed(0)}%</div>
                  <div className="font-mono text-[8px] text-muted-foreground">Rate</div>
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-primary">{bp.metadata?.usage_count || 0}</div>
                  <div className="font-mono text-[8px] text-muted-foreground">Runs</div>
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-foreground/60">{bp.actions?.length || 0}</div>
                  <div className="font-mono text-[8px] text-muted-foreground">Steps</div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); handleRun(bp); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-mono text-[10px]">
                  <Play className="w-3 h-3" /> Run
                </button>
                <Link to={`/blueprints/${bp.blueprint_id}/edit`} onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                  <Edit className="w-3.5 h-3.5" />
                </Link>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(bp); }}
                  className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Blueprints;
