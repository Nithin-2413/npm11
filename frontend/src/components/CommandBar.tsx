import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SUGGESTIONS = [
  "Navigate to https://app.example.com/signup",
  "Fill the registration form with random data",
  "Select any country from the dropdown",
  "Click the submit button",
  "Verify redirect to /dashboard",
  "Take a DOM snapshot",
  "Run blueprint: signup_flow_v1",
  "Run blueprint: login_flow_v1",
  "Check all form validations",
  "Test error handling for 422 response",
];

const HISTORY = [
  { command: "Navigate to signup page, fill form, submit", status: "success" as const, time: "2m ago" },
  { command: "Run blueprint: login_flow_v1 with admin creds", status: "success" as const, time: "8m ago" },
  { command: "Test checkout flow with expired card", status: "error" as const, time: "15m ago" },
  { command: "Verify dashboard loads all widgets", status: "success" as const, time: "22m ago" },
];

export const CommandBar = () => {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = value.length > 0
    ? SUGGESTIONS.filter((s) => s.toLowerCase().includes(value.toLowerCase())).slice(0, 5)
    : [];

  const showDropdown = focused && (filteredSuggestions.length > 0 || showHistory);

  const handleSubmit = (cmd?: string) => {
    const command = cmd || value;
    if (!command.trim()) return;
    setValue("");
    setFocused(false);
    // In a real app this would dispatch the command
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="relative w-full max-w-2xl mx-auto"
    >
      <div className={`glass-panel-strong flex items-center gap-3 px-4 py-3 transition-all ${focused ? "ring-1 ring-primary/40 glass-glow-cyan" : ""}`}>
        <span className="text-lg shrink-0">⚡</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setShowHistory(false); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "ArrowUp" && !value) { setShowHistory(true); }
          }}
          placeholder="Type a QA command... (⌘K)"
          className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        <button
          onClick={() => handleSubmit()}
          className="font-mono text-[10px] px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
        >
          Execute
        </button>
        <button
          onClick={() => { setShowHistory(!showHistory); setFocused(true); }}
          className="font-mono text-[10px] px-2 py-1.5 rounded-lg border border-glass-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors shrink-0"
        >
          History
        </button>
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 glass-panel-strong border border-glass-border rounded-xl overflow-hidden z-50"
          >
            {filteredSuggestions.length > 0 && (
              <div className="p-2">
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider px-2 py-1">Suggestions</p>
                {filteredSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onMouseDown={() => handleSubmit(s)}
                    className="w-full text-left font-mono text-xs px-3 py-2 rounded-lg hover:bg-primary/10 text-foreground/80 hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <span className="text-primary/50">→</span>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {showHistory && (
              <div className="p-2 border-t border-glass-border">
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider px-2 py-1">Recent Commands</p>
                {HISTORY.map((h, i) => (
                  <button
                    key={i}
                    onMouseDown={() => handleSubmit(h.command)}
                    className="w-full text-left font-mono text-xs px-3 py-2 rounded-lg hover:bg-muted/20 transition-colors flex items-center gap-2"
                  >
                    <span className={h.status === "success" ? "text-emerald-400" : "text-destructive"}>
                      {h.status === "success" ? "✓" : "✗"}
                    </span>
                    <span className="text-foreground/70 truncate flex-1">{h.command}</span>
                    <span className="text-muted-foreground text-[10px] shrink-0">{h.time}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
