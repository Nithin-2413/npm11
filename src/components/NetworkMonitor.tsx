import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface NetworkRequest {
  method: string;
  url: string;
  status: number;
  duration: string;
  size: string;
  requestBody?: string;
  responseBody?: string;
  headers?: Record<string, string>;
}

const MOCK_REQUESTS: NetworkRequest[] = [
  { method: "GET", url: "/api/config", status: 200, duration: "45ms", size: "1.2KB", responseBody: '{"env":"production","features":["signup","oauth"]}', headers: { "content-type": "application/json" } },
  { method: "GET", url: "/api/auth/session", status: 200, duration: "120ms", size: "0.8KB", responseBody: '{"authenticated":false}', headers: { "content-type": "application/json" } },
  { method: "POST", url: "/api/auth/register", status: 422, duration: "340ms", size: "0.4KB", requestBody: '{"email":"test@example.com","password":"••••"}', responseBody: '{"error":"terms_accepted is required"}', headers: { "content-type": "application/json" } },
  { method: "POST", url: "/api/auth/register", status: 201, duration: "280ms", size: "1.1KB", requestBody: '{"email":"test@example.com","password":"••••","terms_accepted":true}', responseBody: '{"id":"usr_123","created":true}', headers: { "content-type": "application/json" } },
  { method: "GET", url: "/api/user/profile", status: 200, duration: "95ms", size: "2.3KB", responseBody: '{"name":"Test User","email":"test@example.com"}', headers: { "content-type": "application/json" } },
  { method: "GET", url: "/api/dashboard", status: 200, duration: "210ms", size: "5.6KB" },
  { method: "POST", url: "/api/analytics/event", status: 204, duration: "60ms", size: "0.0KB", requestBody: '{"event":"signup_complete"}' },
  { method: "GET", url: "/assets/logo.svg", status: 304, duration: "12ms", size: "0.0KB" },
];

type FilterType = "all" | "success" | "error" | "redirect";

const statusColor = (status: number) => {
  if (status < 300) return "text-emerald-400";
  if (status < 400) return "text-muted-foreground";
  if (status < 500) return "text-amber-400";
  return "text-destructive";
};

const methodColor = (method: string) => {
  if (method === "GET") return "text-primary";
  if (method === "POST") return "text-glow-purple";
  if (method === "PUT") return "text-amber-400";
  if (method === "DELETE") return "text-destructive";
  return "text-muted-foreground";
};

const filterRequests = (reqs: NetworkRequest[], filter: FilterType) => {
  if (filter === "all") return reqs;
  if (filter === "success") return reqs.filter((r) => r.status >= 200 && r.status < 300);
  if (filter === "error") return reqs.filter((r) => r.status >= 400);
  if (filter === "redirect") return reqs.filter((r) => r.status >= 300 && r.status < 400);
  return reqs;
};

export const NetworkMonitor = () => {
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const filtered = filterRequests(MOCK_REQUESTS, filter);

  const filters: { label: string; value: FilterType; count: number }[] = [
    { label: "All", value: "all", count: MOCK_REQUESTS.length },
    { label: "2xx", value: "success", count: MOCK_REQUESTS.filter((r) => r.status >= 200 && r.status < 300).length },
    { label: "4xx+", value: "error", count: MOCK_REQUESTS.filter((r) => r.status >= 400).length },
    { label: "3xx", value: "redirect", count: MOCK_REQUESTS.filter((r) => r.status >= 300 && r.status < 400).length },
  ];

  return (
    <div className="font-mono text-xs space-y-2 max-h-[320px] overflow-y-auto">
      {/* Filter bar */}
      <div className="flex gap-1 pb-2 border-b border-glass-border">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setExpandedRow(null); }}
            className={`px-2 py-1 rounded text-[10px] transition-all ${
              filter === f.value
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="grid grid-cols-[60px_1fr_60px_60px_60px] gap-2 text-muted-foreground text-[10px] uppercase tracking-wider">
        <span>Method</span>
        <span>URL</span>
        <span>Status</span>
        <span>Time</span>
        <span>Size</span>
      </div>

      {filtered.map((req, i) => {
        const originalIndex = MOCK_REQUESTS.indexOf(req);
        return (
          <div key={originalIndex}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setExpandedRow(expandedRow === originalIndex ? null : originalIndex)}
              className={`grid grid-cols-[60px_1fr_60px_60px_60px] gap-2 py-1.5 rounded px-1 transition-colors cursor-pointer ${
                expandedRow === originalIndex ? "bg-muted/30 ring-1 ring-primary/20" : "hover:bg-muted/20"
              }`}
            >
              <span className={`font-semibold ${methodColor(req.method)}`}>{req.method}</span>
              <span className="text-foreground/80 truncate">{req.url}</span>
              <span className={statusColor(req.status)}>{req.status}</span>
              <span className="text-muted-foreground">{req.duration}</span>
              <span className="text-muted-foreground">{req.size}</span>
            </motion.div>

            <AnimatePresence>
              {expandedRow === originalIndex && (req.requestBody || req.responseBody) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="ml-2 my-1 p-3 rounded-lg border border-glass-border bg-muted/10 space-y-2 text-[11px]">
                    {req.requestBody && (
                      <div>
                        <span className="text-glow-purple font-semibold">Request Body:</span>
                        <pre className="mt-1 text-muted-foreground whitespace-pre-wrap break-all">{req.requestBody}</pre>
                      </div>
                    )}
                    {req.responseBody && (
                      <div>
                        <span className="text-primary font-semibold">Response Body:</span>
                        <pre className="mt-1 text-muted-foreground whitespace-pre-wrap break-all">{req.responseBody}</pre>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-6 text-[11px]">
          No requests match this filter
        </div>
      )}
    </div>
  );
};
