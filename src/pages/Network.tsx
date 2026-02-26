import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/GlassPanel";
import {
  Globe, Wifi, AlertTriangle, ArrowDown, ArrowUp,
  Search, Filter, ChevronDown, X
} from "lucide-react";

interface NetworkReq {
  id: number;
  method: string;
  url: string;
  status: number;
  type: string;
  size: string;
  duration: string;
  initiator: string;
  timing: { dns: string; tcp: string; tls: string; request: string; response: string; total: string };
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
}

const MOCK_NETWORK: NetworkReq[] = [
  { id: 1, method: "GET", url: "https://app.example.com/api/config", status: 200, type: "XHR", size: "1.2KB", duration: "45ms", initiator: "app.js:12",
    timing: { dns: "2ms", tcp: "5ms", tls: "8ms", request: "1ms", response: "29ms", total: "45ms" },
    responseHeaders: { "content-type": "application/json", "cache-control": "max-age=3600" },
    responseBody: '{"env":"production","features":["signup","oauth"]}' },
  { id: 2, method: "GET", url: "https://app.example.com/api/auth/session", status: 200, type: "XHR", size: "0.8KB", duration: "120ms", initiator: "auth.js:45",
    timing: { dns: "1ms", tcp: "3ms", tls: "6ms", request: "2ms", response: "108ms", total: "120ms" },
    responseBody: '{"authenticated":false}' },
  { id: 3, method: "POST", url: "https://app.example.com/api/auth/register", status: 422, type: "XHR", size: "0.4KB", duration: "340ms", initiator: "signup.js:89",
    timing: { dns: "1ms", tcp: "3ms", tls: "6ms", request: "15ms", response: "315ms", total: "340ms" },
    requestBody: '{"email":"test@example.com","password":"S3cure!"}',
    responseBody: '{"error":"terms_accepted is required","code":"VALIDATION_ERROR"}' },
  { id: 4, method: "POST", url: "https://app.example.com/api/auth/register", status: 201, type: "XHR", size: "1.1KB", duration: "280ms", initiator: "signup.js:89",
    timing: { dns: "0ms", tcp: "0ms", tls: "0ms", request: "12ms", response: "268ms", total: "280ms" },
    requestBody: '{"email":"test@example.com","password":"S3cure!","terms_accepted":true}',
    responseBody: '{"id":"usr_abc123","created":true}' },
  { id: 5, method: "GET", url: "https://app.example.com/api/user/profile", status: 200, type: "XHR", size: "2.3KB", duration: "95ms", initiator: "dashboard.js:15",
    timing: { dns: "0ms", tcp: "0ms", tls: "0ms", request: "3ms", response: "92ms", total: "95ms" } },
  { id: 6, method: "GET", url: "https://app.example.com/assets/logo.svg", status: 304, type: "Image", size: "0B", duration: "12ms", initiator: "index.html:8",
    timing: { dns: "0ms", tcp: "0ms", tls: "0ms", request: "1ms", response: "11ms", total: "12ms" } },
  { id: 7, method: "GET", url: "https://app.example.com/api/dashboard", status: 200, type: "XHR", size: "5.6KB", duration: "210ms", initiator: "dashboard.js:22",
    timing: { dns: "0ms", tcp: "0ms", tls: "0ms", request: "5ms", response: "205ms", total: "210ms" } },
  { id: 8, method: "POST", url: "https://app.example.com/api/analytics/event", status: 204, type: "XHR", size: "0B", duration: "60ms", initiator: "analytics.js:33",
    timing: { dns: "0ms", tcp: "0ms", tls: "0ms", request: "8ms", response: "52ms", total: "60ms" },
    requestBody: '{"event":"signup_complete","user_id":"usr_abc123"}' },
];

type MethodFilter = "ALL" | "GET" | "POST" | "PUT" | "DELETE";
type StatusGroup = "all" | "2xx" | "3xx" | "4xx" | "5xx";

const Network = () => {
  const [selectedReq, setSelectedReq] = useState<NetworkReq | null>(null);
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("ALL");
  const [statusGroup, setStatusGroup] = useState<StatusGroup>("all");
  const [search, setSearch] = useState("");
  const [detailTab, setDetailTab] = useState<"general" | "headers" | "payload" | "response" | "timing">("general");

  const filtered = MOCK_NETWORK.filter(r => {
    if (methodFilter !== "ALL" && r.method !== methodFilter) return false;
    if (statusGroup === "2xx" && (r.status < 200 || r.status >= 300)) return false;
    if (statusGroup === "3xx" && (r.status < 300 || r.status >= 400)) return false;
    if (statusGroup === "4xx" && (r.status < 400 || r.status >= 500)) return false;
    if (statusGroup === "5xx" && r.status < 500) return false;
    if (search && !r.url.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSize = MOCK_NETWORK.reduce((acc, r) => acc + parseFloat(r.size) || 0, 0);
  const errorCount = MOCK_NETWORK.filter(r => r.status >= 400).length;
  const avgDuration = Math.round(MOCK_NETWORK.reduce((acc, r) => acc + parseInt(r.duration), 0) / MOCK_NETWORK.length);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight gradient-text flex items-center gap-2">
          <span>🔮</span> Network Monitor
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">Deep dive into network activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Requests", value: MOCK_NETWORK.length.toString(), color: "text-primary", icon: <Globe className="w-4 h-4" /> },
          { label: "Errors", value: errorCount.toString(), color: errorCount > 0 ? "text-destructive" : "text-emerald-400", icon: <AlertTriangle className="w-4 h-4" /> },
          { label: "Avg Response", value: `${avgDuration}ms`, color: "text-secondary", icon: <Wifi className="w-4 h-4" /> },
          { label: "Downloaded", value: `${totalSize.toFixed(1)}KB`, color: "text-primary", icon: <ArrowDown className="w-4 h-4" /> },
          { label: "Uploaded", value: "2.1KB", color: "text-amber-400", icon: <ArrowUp className="w-4 h-4" /> },
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

      {/* Waterfall Preview */}
      <GlassPanel title="Request Waterfall" icon="📊" glow="cyan">
        <div className="space-y-1">
          {MOCK_NETWORK.map((req) => {
            const maxDur = 340;
            const dur = parseInt(req.duration);
            const barWidth = (dur / maxDur) * 100;
            const barColor = dur < 80 ? "bg-emerald-400/40" : dur < 180 ? "bg-amber-400/40" : "bg-red-400/40";
            const durTextColor = dur < 80 ? "text-emerald-400" : dur < 180 ? "text-amber-400" : "text-red-400";
            return (
              <div key={req.id} className="flex items-center gap-2 font-mono text-[10px]">
                <span className={`w-10 font-semibold ${req.method === "POST" ? "text-secondary" : "text-primary"}`}>{req.method}</span>
                <span className="w-32 truncate text-foreground/70">{req.url.split("/").pop()}</span>
                <div className="flex-1 h-4 bg-muted/10 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className={`w-14 text-right ${durTextColor}`}>{req.duration}</span>
              </div>
            );
          })}
        </div>
      </GlassPanel>

      {/* Filters & Table */}
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
        {/* Request Table */}
        <div className="lg:col-span-3">
          <GlassPanel glow="none">
            <div className="grid grid-cols-[50px_40px_1fr_50px_60px_50px] gap-2 px-2 py-2 font-mono text-[9px] text-muted-foreground uppercase tracking-wider border-b border-glass-border">
              <span>Status</span>
              <span>Meth</span>
              <span>URL</span>
              <span>Type</span>
              <span>Duration</span>
              <span>Size</span>
            </div>
            <div className="divide-y divide-glass-border/30 max-h-[400px] overflow-y-auto">
              {filtered.map((req) => (
                <div
                  key={req.id}
                  onClick={() => { setSelectedReq(req); setDetailTab("general"); }}
                  className={`grid grid-cols-[50px_40px_1fr_50px_60px_50px] gap-2 px-2 py-2 items-center cursor-pointer transition-colors font-mono text-[11px] ${
                    selectedReq?.id === req.id ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/10"
                  }`}
                >
                  <span className={req.status >= 400 ? "text-destructive font-bold" : req.status >= 300 ? "text-muted-foreground" : "text-emerald-400"}>{req.status}</span>
                  <span className={req.method === "POST" ? "text-secondary font-semibold" : "text-primary font-semibold"}>{req.method}</span>
                  <span className="truncate text-foreground/70">{req.url.replace("https://app.example.com", "")}</span>
                  <span className="text-muted-foreground">{req.type}</span>
                  <span className="text-muted-foreground">{req.duration}</span>
                  <span className="text-muted-foreground">{req.size}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {selectedReq ? (
            <GlassPanel glow="purple">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs font-semibold text-foreground">Request Details</span>
                <button onClick={() => setSelectedReq(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-3 overflow-x-auto">
                {(["general", "headers", "payload", "response", "timing"] as const).map(tab => (
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
                    <div><span className="text-primary">Status:</span> <span className={selectedReq.status >= 400 ? "text-destructive" : "text-emerald-400"}>{selectedReq.status}</span></div>
                    <div><span className="text-primary">Type:</span> <span className="text-foreground/70">{selectedReq.type}</span></div>
                    <div><span className="text-primary">Initiator:</span> <span className="text-foreground/70">{selectedReq.initiator}</span></div>
                    <div><span className="text-primary">Duration:</span> <span className="text-foreground/70">{selectedReq.duration}</span></div>
                  </>
                )}
                {detailTab === "headers" && (
                  <>
                    {selectedReq.responseHeaders && Object.entries(selectedReq.responseHeaders).map(([k, v]) => (
                      <div key={k}><span className="text-secondary">{k}:</span> <span className="text-foreground/70">{v}</span></div>
                    ))}
                    {!selectedReq.responseHeaders && <p className="text-muted-foreground">No headers captured</p>}
                  </>
                )}
                {detailTab === "payload" && (
                  selectedReq.requestBody
                    ? <pre className="bg-muted/20 rounded-lg p-2 border border-glass-border whitespace-pre-wrap text-foreground/70">{JSON.stringify(JSON.parse(selectedReq.requestBody), null, 2)}</pre>
                    : <p className="text-muted-foreground">No request body</p>
                )}
                {detailTab === "response" && (
                  selectedReq.responseBody
                    ? <pre className="bg-muted/20 rounded-lg p-2 border border-glass-border whitespace-pre-wrap text-foreground/70">{JSON.stringify(JSON.parse(selectedReq.responseBody), null, 2)}</pre>
                    : <p className="text-muted-foreground">No response body</p>
                )}
                {detailTab === "timing" && (
                  <div className="space-y-2">
                    {Object.entries(selectedReq.timing).map(([phase, time]) => (
                      <div key={phase} className="flex items-center gap-2">
                        <span className="text-primary capitalize w-20">{phase}:</span>
                        <div className="flex-1 h-3 bg-muted/10 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/30 rounded-full" style={{ width: `${(parseInt(time) / parseInt(selectedReq.timing.total)) * 100}%` }} />
                        </div>
                        <span className="text-foreground/70 w-12 text-right">{time}</span>
                      </div>
                    ))}
                  </div>
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
  );
};

export default Network;
