import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";

const SHORTCUTS = [
  { keys: ["⌘", "K"], description: "Open search" },
  { keys: ["⌘", "Enter"], description: "Execute command" },
  { keys: ["?"], description: "Show shortcuts" },
  { keys: ["G", "D"], description: "Go to Dashboard" },
  { keys: ["G", "E"], description: "Go to Execute" },
  { keys: ["G", "B"], description: "Go to Blueprints" },
  { keys: ["G", "R"], description: "Go to Reports" },
  { keys: ["G", "S"], description: "Go to Settings" },
  { keys: ["Esc"], description: "Close modal/panel" },
];

export const KeyboardShortcutsModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        onClick={() => setOpen(false)}
      >
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm rounded-2xl border border-glass-border shadow-2xl overflow-hidden"
          style={{ background: "hsl(var(--glass-bg))", backdropFilter: "blur(40px)" }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-glass-border">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm font-semibold text-foreground">Keyboard Shortcuts</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-2">
            {SHORTCUTS.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="font-mono text-xs text-muted-foreground">{s.description}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map((key, j) => (
                    <span key={j}>
                      <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-glass-border text-foreground/70 bg-muted/20 min-w-[22px] text-center inline-block">
                        {key}
                      </kbd>
                      {j < s.keys.length - 1 && <span className="text-muted-foreground/30 mx-0.5 text-[10px]">+</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-glass-border">
            <span className="font-mono text-[9px] text-muted-foreground">Press <kbd className="px-1 py-0.5 rounded border border-glass-border text-[8px]">?</kbd> to toggle</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
