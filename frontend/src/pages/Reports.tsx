import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { StatusBadge, StatusType } from "@/components/StatusBadge";
import { toast } from "sonner";
import {
  Search, Download, Eye, Trash2,
  ChevronLeft, ChevronRight, Globe, Loader2, RefreshCw
} from "lucide-react";
import { listReports, deleteReport, exportReport, Execution } from "@/lib/api";

const Reports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Execution[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusType>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const perPage = 8;

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), page_size: String(perPage) };
      if (statusFilter !== "all") params.status = statusFilter.toUpperCase();
      const data = await listReports(params as never);
      setReports(data.reports);
      setTotal(data.total);
    } catch (err) {
      console.error("Reports fetch error:", err);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const filtered = reports.filter(r => {
    if (!search) return true;
    return (r.command || "").toLowerCase().includes(search.toLowerCase()) ||
      r.execution_id.toLowerCase().includes(search.toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleExport = (id: string) => exportReport(id, "json");

  const handleDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => deleteReport(id)));
      setSelectedIds([]);
      toast.success(`Deleted ${ids.length} report(s)`);
      fetchReports();
    } catch {
      toast.error("Delete failed");
    }
  };

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2" style={{ fontFamily: "'Sen', sans-serif" }}>
            <span>📊</span> <span className="text-foreground/60">Execution Reports</span>
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">{total} total executions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchReports} className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <Link to="/network" className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
            <Globe className="w-3.5 h-3.5" /> Network
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-md glass-panel-strong flex items-center gap-2 px-3 py-2 rounded-xl">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by command or ID..."
            className="flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "success", "failure", "partial"] as const).map(f => (
            <button key={f} onClick={() => { setStatusFilter(f); setPage(1); }}
              className={`font-mono text-[10px] px-2.5 py-1.5 rounded-lg border transition-all capitalize ${statusFilter === f ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >{f}</button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel glass-glow-cyan p-3 flex items-center gap-3">
          <span className="font-mono text-xs text-primary">{selectedIds.length} selected</span>
          <button onClick={() => handleDelete(selectedIds)} className="font-mono text-[10px] px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <button onClick={() => setSelectedIds([])} className="ml-auto font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
        </motion.div>
      )}

      {/* Reports List */}
      <div className="space-y-2">
        {loading ? (
          <GlassPanel glow="none">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          </GlassPanel>
        ) : filtered.length === 0 ? (
          <GlassPanel glow="none">
            <div className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">
              No reports yet. Run your first execution to see results here!</div>
          </GlassPanel>
        ) : filtered.map((report) => (
          <motion.div
            key={report.execution_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-panel p-4 hover:bg-muted/5 transition-all group cursor-pointer ${
              selectedIds.includes(report.execution_id) ? "ring-1 ring-primary/30 bg-primary/5" : ""
            }`}
            onClick={() => navigate(`/reports/${report.execution_id}`)}
          >
            <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedIds.includes(report.execution_id)}
                onChange={(e) => { e.stopPropagation(); toggleSelect(report.execution_id); }}
                onClick={(e) => e.stopPropagation()}
                className="accent-primary w-3.5 h-3.5 shrink-0 mt-1"
              />

              {/* Status */}
              <StatusBadge status={report.status.toLowerCase() as StatusType} className="shrink-0 mt-0.5" />

              {/* Main Info */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <span className="font-mono text-sm text-foreground font-medium block truncate">
                  {report.command || `Blueprint: ${report.blueprint_name}`}
                </span>
                <div className="flex items-center gap-3 mt-1">
                  {report.blueprint_id && (
                    <span className="font-mono text-[10px] text-secondary flex items-center gap-1">
                      📐 {report.blueprint_name || report.blueprint_id}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {report.execution_id}
                  </span>
                </div>
              </div>

              {/* Metrics */}
              <div className="hidden md:flex items-center gap-5 shrink-0">
                <div className="text-center">
                  <div className="font-mono text-xs font-semibold text-primary">{report.successful_actions}/{report.total_actions}</div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Actions</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-xs font-semibold text-foreground/80">{report.duration_seconds.toFixed(1)}s</div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Duration</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-xs font-semibold text-muted-foreground">{report.network_logs?.length || 0}</div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Requests</div>
                </div>
                <div className="text-center">
                  <div className={`font-mono text-xs font-bold ${report.failed_actions > 0 ? "text-destructive" : "text-emerald-400"}`}>
                    {report.failed_actions}
                  </div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Errors</div>
                </div>
              </div>

              {/* Time & Action */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[10px] text-muted-foreground hidden sm:block">
                  {formatTime(report.timestamp)}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleExport(report.execution_id); }}
                    className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <Link to={`/reports/${report.execution_id}`} onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {total > perPage && (
        <div className="flex items-center justify-between glass-panel p-3">
          <span className="font-mono text-[10px] text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`font-mono text-[10px] w-7 h-7 rounded-lg transition-colors ${page === i + 1 ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"}`}
              >{i + 1}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
