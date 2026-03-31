import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/GlassPanel";
import {
  Globe, Wifi, AlertTriangle, ArrowDown, ArrowUp,
  Search, Filter, ChevronDown, X, Loader2, RefreshCw
} from "lucide-react";
import { getNetworkLogs, NetworkRequest } from "@/lib/api";

type MethodFilter = "ALL" | "GET" | "POST" | "PUT" | "DELETE";
type StatusGroup = "all" | "2xx" | "3xx" | "4xx" | "5xx";

const Network = () => {
  const [searchParams] = useSearchParams();
  const execId = searchParams.get("execution_id");
  const [executionId, setExecutionId] = useState(execId || "");
  const [networkLogs, setNetworkLogs] = useState<NetworkRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReq, setSelectedReq] = useState<NetworkRequest | null>(null);
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("ALL");
  const [statusGroup, setStatusGroup] = useState<StatusGroup>("all");
  const [search, setSearch] = useState("");
  const [detailTab, setDetailTab] = useState<"general" | "headers" | "payload" | "response" | "timing">("general");

  useEffect(() => {
    if (execId) {
      setExecutionId(execId);
      fetchLogs(execId);
    }
  }, [execId]);

  const fetchLogs = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    try {
      const data = await getNetworkLogs(id);
      setNetworkLogs(data.requests);
    } catch (err) {
      console.error("Network logs fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = networkLogs.filter(r => {
    const matchMethod = methodFilter === "ALL" || r.method === methodFilter;
    const matchStatus = statusGroup === "all" ||
      (statusGroup === "2xx" && r.status >= 200 && r.status < 300) ||
      (statusGroup === "3xx" && r.status >= 300 && r.status < 400) ||
      (statusGroup === "4xx" && r.status >= 400 && r.status < 500) ||
      (statusGroup === "5xx" && r.status >= 500);
    const matchSearch = !search || r.url.toLowerCase().includes(search.toLowerCase());
    return matchMethod && matchStatus && matchSearch;
  });

  const errorCount = networkLogs.filter(r => r.is_error).length;
  const avgDuration = networkLogs.length ? Math.round(networkLogs.reduce((a, r) => a + r.duration_ms, 0) / networkLogs.length) : 0;
  const totalSize = networkLogs.reduce((a, r) => a + r.size_bytes, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight gradient-text flex items-center gap-2">
            <span>🔮</span> Network Monitor
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">Deep dive into network activity from executions</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={executionId}
            onChange={(e) => setExecutionId(e.target.value)}
            placeholder="Enter execution ID..."
            className="glass-panel-strong px-3 py-2 rounded-xl font-mono text-xs text-foreground bg-transparent outline-none w-56"
          />
          <button onClick={() => fetchLogs(executionId)} disabled={loading || !executionId.trim()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Load
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Requests", value: networkLogs.length.toString(), color: "text-primary", icon: <Globe className="w-4 h-4" /> },
          { label: "Errors", value: errorCount.toString(), color: errorCount > 0 ? "text-destructive" : "text-emerald-400", icon: <AlertTriangle className="w-4 h-4" /> },
          { label: "Avg Response", value: `${avgDuration}ms`, color: "text-secondary", icon: <Wifi className="w-4 h-4" /> },
          { label: "Data Transferred", value: `${(totalSize / 1024).toFixed(1)}KB`, color: "text-primary", icon: <ArrowDown className="w-4 h-4" /> },
        ].map((stat) => (
          <div key={stat.label} className="glass-panel p-3 flex items-center gap-3">
            <span className={`${stat.color} opacity-60`}>{stat.icon}</span>
            <div>
              <div className={`font-mono text-lg font-bold ${stat.color}`}>{stat.value}</div>
              <div className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Waterfall */}
      {filteredLogs.length > 0 && (
        <GlassPanel title="Request Waterfall" icon="📊" glow="cyan">
          <div className="space-y-1">
            {filteredLogs.slice(0, 20).map((req, i) => {
              const maxDur = Math.max(...filteredLogs.map(r => r.duration_ms)) || 1000;
              const barWidth = (req.duration_ms / maxDur) * 100;
              const barColor = req.duration_ms < 100 ? "bg-emerald-400/40" : req.duration_ms < 500 ? "bg-amber-400/40" : "bg-red-400/40";
              const durTextColor = req.duration_ms < 100 ? "text-emerald-400" : req.duration_ms < 500 ? "text-amber-400" : "text-red-400";
              return (
                <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                  <span className={`w-10 font-semibold ${req.method === "POST" ? "text-secondary" : "text-primary"}`}>{req.method}</span>
                  <span className="w-32 truncate text-foreground/70">{req.url.split("/").pop() || req.url.slice(0, 20)}</span>
                  <div className="flex-1 h-4 bg-muted/10 rounded-full overflow-hidden relative">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className={`w-14 text-right ${durTextColor}`}>{req.duration_ms}ms</span>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Empty state if no execution loaded */}
      {!loading && networkLogs.length === 0 && (
        <GlassPanel glow="none">
          <div className="text-center py-12 font-mono text-sm text-muted-foreground">
            {executionId ? "No network logs found for this execution." : "Enter an execution ID above to view its network activity."}
          </div>
        </GlassPanel>
      )}

      {loading && (
        <GlassPanel glow="none">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </GlassPanel>
      )}

      {/* Filters & Table */}
      {filteredLogs.length > 0 && (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-sm glass-panel-strong flex items-center gap-2 px-3 py-2 rounded-xl">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter URL..." className="flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
          <div className="flex gap-1">
            {(["ALL", "GET", "POST", "PUT", "DELETE"] as MethodFilter[]).map(m => (
              <button key={m} onClick={() => setMethodFilter(m)}
                className={`font-mono text-[10px] px-2 py-1 rounded-lg border transition-all ${methodFilter === m ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >{m}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["all", "2xx", "3xx", "4xx", "5xx"] as StatusGroup[]).map(s => (
              <button key={s} onClick={() => setStatusGroup(s)}
                className={`font-mono text-[10px] px-2 py-1 rounded-lg border transition-all ${statusGroup === s ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >{s}</button>
            ))}
          </div>
        </div>
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <GlassPanel glow="none">
              <div className="grid grid-cols-[50px_50px_1fr_60px_50px] gap-2 px-2 py-2 font-mono text-[9px] text-muted-foreground uppercase tracking-wider border-b border-glass-border">
                <span>Status</span>
                <span>Meth</span>
                <span>URL</span>
                <span>Duration</span>
                <span>Size</span>
              </div>
              <div className="divide-y divide-glass-border/30 max-h-[400px] overflow-y-auto">
                {filteredLogs.map((req, i) => (
                  <div
                    key={i}
                    onClick={() => { setSelectedReq(req); setDetailTab("general"); }}
                    title={`${req.method} ${req.url}`}
                    className={`grid grid-cols-[50px_50px_1fr_60px_50px] gap-2 px-2 py-2 items-center cursor-pointer transition-colors font-mono text-[11px] ${
                      selectedReq?.request_id === req.request_id ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/10"
                    }`}
                  >
                    <span className={req.status >= 400 ? "text-destructive font-bold" : req.status >= 300 ? "text-muted-foreground" : "text-emerald-400"}>{req.status || "ERR"}</span>
                    <span className={req.method === "POST" ? "text-secondary font-semibold" : "text-primary font-semibold"}>{req.method}</span>
                    <span className="truncate text-foreground/70">{req.url.replace(/^https?:\/\/[^/]+/, "")}</span>
                    <span className="text-muted-foreground">{req.duration_ms}ms</span>
                    <span className="text-muted-foreground">{req.size_bytes > 0 ? `${(req.size_bytes / 1024).toFixed(1)}K` : "—"}</span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>

          <div className="lg:col-span-2">
            {selectedReq ? (
              <GlassPanel glow="purple">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-semibold text-foreground">Request Details</span>
                  <button onClick={() => setSelectedReq(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-1 mb-3 overflow-x-auto">
                  {(["general", "payload", "response"] as const).map(tab => (
                    <button key={tab} onClick={() => setDetailTab(tab)}
                      className={`font-mono text-[10px] px-2.5 py-1 rounded-lg border transition-all capitalize whitespace-nowrap ${
                        detailTab === tab ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >{tab}</button>
                  ))}
                </div>
                <div className="font-mono text-[11px] space-y-2 max-h-[350px] overflow-y-auto">
                  {detailTab === "general" && (
                    <>
                      <div><span className="text-primary">URL:</span> <span className="text-foreground/70 break-all">{selectedReq.url}</span></div>
                      <div><span className="text-primary">Method:</span> <span className="text-foreground/70">{selectedReq.method}</span></div>
                      <div><span className="text-primary">Status:</span> <span className={selectedReq.status >= 400 ? "text-destructive" : "text-emerald-400"}>{selectedReq.status || "Failed"}</span></div>
                      <div><span className="text-primary">Duration:</span> <span className="text-foreground/70">{selectedReq.duration_ms}ms</span></div>
                      <div><span className="text-primary">Size:</span> <span className="text-foreground/70">{selectedReq.size_bytes} bytes</span></div>
                      <div><span className="text-primary">Content-Type:</span> <span className="text-foreground/70">{selectedReq.content_type || "—"}</span></div>
                    </>
                  )}
                  {detailTab === "payload" && (
                    <div className="text-muted-foreground">No request body captured.</div>
                  )}
                  {detailTab === "response" && (
                    selectedReq.response_body
                      ? <pre className="bg-muted/20 rounded-lg p-2 border border-glass-border whitespace-pre-wrap text-foreground/70">{selectedReq.response_body}</pre>
                      : <p className="text-muted-foreground">No response body captured</p>
                  )}
                </div>
              </GlassPanel>
            ) : (
              <div className="glass-panel p-8 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <Globe className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="font-mono text-xs text-muted-foreground">Select a request to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default Network;
