import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Search, X, FileCode2, ClipboardList, Play, Globe, Settings,
  ArrowRight, CornerDownLeft
} from "lucide-react";

interface SearchResult {
  type: "page" | "blueprint" | "report" | "action";
  label: string;
  description: string;
  path: string;
  icon: React.ReactNode;
}

const ALL_RESULTS: SearchResult[] = [
  { type: "page", label: "Dashboard", description: "Overview & quick execute", path: "/", icon: <Play className="w-3.5 h-3.5" /> },
  { type: "page", label: "Execute", description: "Live execution monitor", path: "/execute", icon: <Play className="w-3.5 h-3.5" /> },
  { type: "page", label: "Blueprints", description: "Manage saved flows", path: "/blueprints", icon: <FileCode2 className="w-3.5 h-3.5" /> },
  { type: "page", label: "Reports", description: "Execution history", path: "/reports", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { type: "page", label: "Network", description: "Network activity monitor", path: "/network", icon: <Globe className="w-3.5 h-3.5" /> },
  { type: "page", label: "Settings", description: "Configure system", path: "/settings", icon: <Settings className="w-3.5 h-3.5" /> },
  { type: "blueprint", label: "Signup Flow", description: "signup_flow_v1 — 7 actions", path: "/blueprints/signup_flow_v1/edit", icon: <FileCode2 className="w-3.5 h-3.5 text-secondary" /> },
  { type: "blueprint", label: "Login Flow", description: "login_flow_v1 — 5 actions", path: "/blueprints/login_flow_v1/edit", icon: <FileCode2 className="w-3.5 h-3.5 text-secondary" /> },
  { type: "blueprint", label: "Checkout Flow", description: "checkout_flow_v1 — 5 actions", path: "/blueprints/checkout_flow_v1/edit", icon: <FileCode2 className="w-3.5 h-3.5 text-secondary" /> },
  { type: "report", label: "exec_001", description: "Navigate to signup, fill form, submit — Success", path: "/reports/exec_001", icon: <ClipboardList className="w-3.5 h-3.5 text-emerald-400" /> },
  { type: "report", label: "exec_003", description: "Test checkout with expired card — Failed", path: "/reports/exec_003", icon: <ClipboardList className="w-3.5 h-3.5 text-destructive" /> },
  { type: "action", label: "New Execution", description: "Run a new QA command", path: "/execute", icon: <Play className="w-3.5 h-3.5 text-primary" /> },
  { type: "action", label: "Create Blueprint", description: "Build a new action sequence", path: "/blueprints/create", icon: <FileCode2 className="w-3.5 h-3.5 text-primary" /> },
];

export const GlobalSearchModal = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = query.trim()
    ? ALL_RESULTS.filter(r =>
        r.label.toLowerCase().includes(query.toLowerCase()) ||
        r.description.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_RESULTS.filter(r => r.type === "page" || r.type === "action");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const customHandler = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener("open-search", customHandler);
    return () => { window.removeEventListener("keydown", handler); window.removeEventListener("open-search", customHandler); };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const go = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selectedIndex]) { go(results[selectedIndex].path); }
  };

  if (!open) return null;

  const grouped: Record<string, SearchResult[]> = {};
  results.forEach(r => {
    const key = r.type === "action" ? "Quick Actions" : r.type === "page" ? "Pages" : r.type === "blueprint" ? "Blueprints" : "Reports";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  let flatIndex = 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
        onClick={() => setOpen(false)}
      >
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-2xl border border-glass-border shadow-2xl overflow-hidden"
          style={{ background: "hsl(var(--glass-bg))", backdropFilter: "blur(40px)" }}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-glass-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, blueprints, reports..."
              className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-glass-border text-muted-foreground">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[340px] overflow-y-auto p-2">
            {results.length === 0 ? (
              <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                No results for "{query}"
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="mb-2">
                  <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider px-2 py-1">{group}</div>
                  {items.map((item) => {
                    const thisIndex = flatIndex++;
                    return (
                      <button
                        key={`${item.type}-${item.label}`}
                        onClick={() => go(item.path)}
                        onMouseEnter={() => setSelectedIndex(thisIndex)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-mono text-xs transition-all text-left ${
                          selectedIndex === thisIndex
                            ? "bg-primary/10 text-primary"
                            : "text-foreground/80 hover:bg-muted/20"
                        }`}
                      >
                        {item.icon}
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{item.label}</span>
                          <span className="text-muted-foreground ml-2 text-[10px]">{item.description}</span>
                        </div>
                        {selectedIndex === thisIndex && (
                          <CornerDownLeft className="w-3 h-3 text-primary/50 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-glass-border">
            <span className="font-mono text-[9px] text-muted-foreground flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-glass-border text-[8px]">↑↓</kbd> Navigate
            </span>
            <span className="font-mono text-[9px] text-muted-foreground flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-glass-border text-[8px]">↵</kbd> Open
            </span>
            <span className="font-mono text-[9px] text-muted-foreground flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-glass-border text-[8px]">esc</kbd> Close
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
