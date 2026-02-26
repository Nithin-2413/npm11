import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { StatusBadge, StatusType } from "@/components/StatusBadge";
import { toast } from "sonner";
import {
  Search, Download, Eye, Trash2,
  ChevronLeft, ChevronRight, Globe
} from "lucide-react";

interface Report {
  id: string;
  command: string;
  blueprint?: string;
  status: StatusType;
  startTime: string;
  duration: string;
  actionsCompleted: string;
  networkRequests: number;
  errors: number;
}

const INITIAL_REPORTS: Report[] = [
  { id: "exec_001", command: "Navigate to signup, fill form, submit", blueprint: "signup_flow_v1", status: "success", startTime: "2026-02-24 14:32", duration: "6.5s", actionsCompleted: "7/7", networkRequests: 8, errors: 0 },
  { id: "exec_002", command: "Run blueprint: login_flow_v1", blueprint: "login_flow_v1", status: "success", startTime: "2026-02-24 14:25", duration: "2.1s", actionsCompleted: "5/5", networkRequests: 4, errors: 0 },
  { id: "exec_003", command: "Test checkout with expired card", status: "failure", startTime: "2026-02-24 14:18", duration: "4.8s", actionsCompleted: "2/4", networkRequests: 6, errors: 2 },
  { id: "exec_004", command: "Verify dashboard widgets load", status: "success", startTime: "2026-02-24 14:10", duration: "3.2s", actionsCompleted: "3/3", networkRequests: 12, errors: 0 },
  { id: "exec_005", command: "Fill profile settings, upload avatar", status: "partial", startTime: "2026-02-24 13:55", duration: "5.1s", actionsCompleted: "4/6", networkRequests: 9, errors: 1 },
  { id: "exec_006", command: "Run signup_flow_v1 with random data", blueprint: "signup_flow_v1", status: "success", startTime: "2026-02-24 13:40", duration: "7.2s", actionsCompleted: "7/7", networkRequests: 8, errors: 0 },
  { id: "exec_007", command: "Test password reset flow", status: "success", startTime: "2026-02-24 12:30", duration: "4.1s", actionsCompleted: "6/6", networkRequests: 5, errors: 0 },
  { id: "exec_008", command: "Verify email verification link", status: "failure", startTime: "2026-02-24 12:15", duration: "8.3s", actionsCompleted: "3/5", networkRequests: 7, errors: 3 },
  { id: "exec_009", command: "Test multi-language switching", status: "success", startTime: "2026-02-24 11:45", duration: "3.8s", actionsCompleted: "4/4", networkRequests: 3, errors: 0 },
  { id: "exec_010", command: "Run full regression suite", status: "partial", startTime: "2026-02-24 11:00", duration: "45.2s", actionsCompleted: "18/22", networkRequests: 42, errors: 4 },
];

const Reports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>(INITIAL_REPORTS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusType>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState("7");
  const perPage = 8;

  const filtered = reports
    .filter(r => {
      const matchSearch = !search || r.command.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === paginated.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginated.map(r => r.id));
    }
  };

  const exportReports = useCallback((ids?: string[]) => {
    const toExport = ids ? reports.filter(r => ids.includes(r.id)) : filtered;
    const json = JSON.stringify(toExport, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `npm-reports-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${toExport.length} report(s)`);
  }, [reports, filtered]);

  const deleteReports = useCallback((ids: string[]) => {
    setReports(prev => prev.filter(r => !ids.includes(r.id)));
    setSelectedIds([]);
    toast.success(`Deleted ${ids.length} report(s)`);
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2" style={{ fontFamily: "'Sen', sans-serif" }}>
            <span>📊</span> <span className="text-foreground/60">Execution Reports</span>
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">{reports.length} total executions</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="glass-panel-strong px-3 py-2 rounded-xl font-mono text-xs text-foreground bg-transparent outline-none cursor-pointer"
          >
            <option className="bg-background" value="7">Last 7 Days</option>
            <option className="bg-background" value="30">Last 30 Days</option>
            <option className="bg-background" value="90">Last 90 Days</option>
            <option className="bg-background" value="all">All Time</option>
          </select>
          <Link
            to="/network"
            className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <Globe className="w-3.5 h-3.5" /> Network
          </Link>
          <button
            onClick={() => exportReports()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
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
          {(["all", "failure", "partial"] as const).map(f => (
            <button
              key={f}
              onClick={() => { setStatusFilter(f); setPage(1); }}
              className={`font-mono text-[10px] px-2.5 py-1.5 rounded-lg border transition-all capitalize ${
                statusFilter === f
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel glass-glow-cyan p-3 flex items-center gap-3"
        >
          <span className="font-mono text-xs text-primary">{selectedIds.length} selected</span>
          <button
            onClick={() => deleteReports(selectedIds)}
            className="font-mono text-[10px] px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <button
            onClick={() => exportReports(selectedIds)}
            className="font-mono text-[10px] px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> Export
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="ml-auto font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </motion.div>
      )}

      {/* Reports List */}
      <div className="space-y-2">
        {paginated.length === 0 ? (
          <GlassPanel glow="none">
            <div className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">
              No reports match your filters.
            </div>
          </GlassPanel>
        ) : paginated.map((report) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-panel p-4 hover:bg-muted/5 transition-all group cursor-pointer ${
              selectedIds.includes(report.id) ? "ring-1 ring-primary/30 bg-primary/5" : ""
            }`}
            onClick={() => navigate(`/reports/${report.id}`)}
          >
            <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedIds.includes(report.id)}
                onChange={(e) => { e.stopPropagation(); toggleSelect(report.id); }}
                onClick={(e) => e.stopPropagation()}
                className="accent-primary w-3.5 h-3.5 shrink-0 mt-1"
              />

              {/* Status */}
              <StatusBadge status={report.status} className="shrink-0 mt-0.5" />

              {/* Main Info */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <span className="font-mono text-sm text-foreground font-medium block truncate">
                  {report.command}
                </span>
                <div className="flex items-center gap-3 mt-1">
                  {report.blueprint && (
                    <span className="font-mono text-[10px] text-secondary flex items-center gap-1">
                      📐 {report.blueprint}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {report.id}
                  </span>
                </div>
              </div>

              {/* Metrics */}
              <div className="hidden md:flex items-center gap-5 shrink-0">
                <div className="text-center">
                  <div className="font-mono text-xs font-semibold text-primary">{report.actionsCompleted}</div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Actions</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-xs font-semibold text-foreground/80">{report.duration}</div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Duration</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-xs font-semibold text-muted-foreground">{report.networkRequests}</div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Requests</div>
                </div>
                <div className="text-center">
                  <div className={`font-mono text-xs font-bold ${report.errors > 0 ? "text-destructive" : "text-emerald-400"}`}>
                    {report.errors}
                  </div>
                  <div className="font-mono text-[8px] text-muted-foreground uppercase">Errors</div>
                </div>
              </div>

              {/* Time & Action */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[10px] text-muted-foreground hidden sm:block">
                  {report.startTime.split(" ")[1]}
                </span>
                <Link
                  to={`/reports/${report.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Eye className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {filtered.length > perPage && (
        <div className="flex items-center justify-between glass-panel p-3">
          <span className="font-mono text-[10px] text-muted-foreground">
            Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`font-mono text-[10px] w-7 h-7 rounded-lg transition-colors ${
                  page === i + 1 ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
