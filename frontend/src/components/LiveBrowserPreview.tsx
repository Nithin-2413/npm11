import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BrowserFrame {
  url: string;
  title: string;
  elements: { selector: string; label: string; x: number; y: number; w: number; h: number; filled?: string; highlighted?: boolean }[];
}

const FRAMES: BrowserFrame[] = [
  {
    url: "https://app.example.com/signup",
    title: "Sign Up — Example App",
    elements: [
      { selector: "input#email", label: "Email", x: 15, y: 30, w: 70, h: 8 },
      { selector: "input#password", label: "Password", x: 15, y: 44, w: 70, h: 8 },
      { selector: "select#country", label: "Country", x: 15, y: 58, w: 70, h: 8 },
      { selector: "input#terms", label: "I accept terms", x: 15, y: 70, w: 4, h: 4 },
      { selector: "button#submit", label: "Sign Up", x: 15, y: 80, w: 30, h: 8 },
    ],
  },
  {
    url: "https://app.example.com/signup",
    title: "Sign Up — Example App",
    elements: [
      { selector: "input#email", label: "Email", x: 15, y: 30, w: 70, h: 8, filled: "test@example.com", highlighted: true },
      { selector: "input#password", label: "Password", x: 15, y: 44, w: 70, h: 8 },
      { selector: "select#country", label: "Country", x: 15, y: 58, w: 70, h: 8 },
      { selector: "input#terms", label: "I accept terms", x: 15, y: 70, w: 4, h: 4 },
      { selector: "button#submit", label: "Sign Up", x: 15, y: 80, w: 30, h: 8 },
    ],
  },
  {
    url: "https://app.example.com/signup",
    title: "Sign Up — Example App",
    elements: [
      { selector: "input#email", label: "Email", x: 15, y: 30, w: 70, h: 8, filled: "test@example.com" },
      { selector: "input#password", label: "Password", x: 15, y: 44, w: 70, h: 8, filled: "••••••••", highlighted: true },
      { selector: "select#country", label: "Country", x: 15, y: 58, w: 70, h: 8 },
      { selector: "input#terms", label: "I accept terms", x: 15, y: 70, w: 4, h: 4 },
      { selector: "button#submit", label: "Sign Up", x: 15, y: 80, w: 30, h: 8 },
    ],
  },
  {
    url: "https://app.example.com/signup",
    title: "Sign Up — Example App",
    elements: [
      { selector: "input#email", label: "Email", x: 15, y: 30, w: 70, h: 8, filled: "test@example.com" },
      { selector: "input#password", label: "Password", x: 15, y: 44, w: 70, h: 8, filled: "••••••••" },
      { selector: "select#country", label: "Country", x: 15, y: 58, w: 70, h: 8, filled: "United States", highlighted: true },
      { selector: "input#terms", label: "I accept terms", x: 15, y: 70, w: 4, h: 4 },
      { selector: "button#submit", label: "Sign Up", x: 15, y: 80, w: 30, h: 8 },
    ],
  },
  {
    url: "https://app.example.com/signup",
    title: "Sign Up — Example App",
    elements: [
      { selector: "input#email", label: "Email", x: 15, y: 30, w: 70, h: 8, filled: "test@example.com" },
      { selector: "input#password", label: "Password", x: 15, y: 44, w: 70, h: 8, filled: "••••••••" },
      { selector: "select#country", label: "Country", x: 15, y: 58, w: 70, h: 8, filled: "United States" },
      { selector: "input#terms", label: "I accept terms", x: 15, y: 70, w: 4, h: 4, highlighted: true },
      { selector: "button#submit", label: "Sign Up", x: 15, y: 80, w: 30, h: 8 },
    ],
  },
  {
    url: "https://app.example.com/signup",
    title: "Sign Up — Example App",
    elements: [
      { selector: "input#email", label: "Email", x: 15, y: 30, w: 70, h: 8, filled: "test@example.com" },
      { selector: "input#password", label: "Password", x: 15, y: 44, w: 70, h: 8, filled: "••••••••" },
      { selector: "select#country", label: "Country", x: 15, y: 58, w: 70, h: 8, filled: "United States" },
      { selector: "input#terms", label: "I accept terms", x: 15, y: 70, w: 4, h: 4 },
      { selector: "button#submit", label: "Sign Up", x: 15, y: 80, w: 30, h: 8, highlighted: true },
    ],
  },
  {
    url: "https://app.example.com/dashboard",
    title: "Dashboard — Example App",
    elements: [
      { selector: "h1.welcome", label: "Welcome, Test User!", x: 10, y: 25, w: 80, h: 12 },
      { selector: "div.stats", label: "📊 Your Stats", x: 10, y: 45, w: 80, h: 20 },
      { selector: "nav.sidebar", label: "Navigation", x: 10, y: 72, w: 30, h: 15 },
    ],
  },
];

interface LiveBrowserPreviewProps {
  screenshotUrl?: string | null;
  isRunning?: boolean;
}

export const LiveBrowserPreview = ({ screenshotUrl, isRunning }: LiveBrowserPreviewProps = {}) => {
  const [frameIndex, setFrameIndex] = useState(0);

  // Only animate mock frames if no real screenshot
  useEffect(() => {
    if (screenshotUrl) return;
    const timer = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % FRAMES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [screenshotUrl]);

  // If we have a real screenshot, show it
  if (screenshotUrl) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-glass-border bg-muted/30 rounded-t-xl">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="flex-1 bg-muted/30 rounded-lg px-3 py-1 font-mono text-[10px] text-muted-foreground truncate">
            {isRunning ? "Automating..." : "Last screenshot"}
          </div>
          {isRunning && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
        </div>
        <div className="relative flex-1 bg-muted/10 rounded-b-xl overflow-hidden min-h-[250px] flex items-center justify-center">
          <img src={screenshotUrl} alt="Browser screenshot" className="max-w-full max-h-full object-contain" />
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-glass-border/30 font-mono text-[9px] text-muted-foreground">
          <span>{isRunning ? "Live capture" : "Latest screenshot"}</span>
          <a href={screenshotUrl} target="_blank" rel="noreferrer" className="text-primary/60 hover:text-primary">Open full</a>
        </div>
      </div>
    );
  }

  const frame = FRAMES[frameIndex];
  const highlighted = frame.elements.find(e => e.highlighted);

  return (
    <div className="flex flex-col h-full">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-glass-border bg-muted/30 rounded-t-xl">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 bg-muted/30 rounded-lg px-3 py-1 font-mono text-[10px] text-muted-foreground truncate">
          {frame.url}
        </div>
      </div>

      {/* Page content */}
      <div className="relative flex-1 bg-muted/10 rounded-b-xl overflow-hidden min-h-[250px]">
        {/* Page title bar */}
        <div className="px-4 py-2 border-b border-glass-border/30">
          <span className="font-mono text-[10px] text-foreground/60">{frame.title}</span>
        </div>

        {/* Mock elements */}
        <AnimatePresence mode="wait">
          <motion.div
            key={frameIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 top-8"
          >
            {frame.elements.map((el) => (
              <div
                key={el.selector}
                className={`absolute font-mono text-[9px] transition-all duration-300 ${
                  el.highlighted
                    ? "ring-2 ring-primary ring-offset-1 ring-offset-background z-10"
                    : ""
                }`}
                style={{
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: `${el.w}%`,
                  height: `${el.h}%`,
                }}
              >
                {el.selector.startsWith("input#terms") ? (
                  <div className="flex items-center gap-1.5 h-full">
                    <div className={`w-3 h-3 rounded border ${el.highlighted ? "border-primary bg-primary/20" : "border-glass-border"} flex items-center justify-center`}>
                      {!el.highlighted && frameIndex > 4 && <span className="text-primary text-[8px]">✓</span>}
                    </div>
                    <span className="text-muted-foreground">{el.label}</span>
                  </div>
                ) : el.selector.startsWith("button") ? (
                  <div className={`h-full rounded-lg flex items-center justify-center ${
                    el.highlighted ? "bg-primary/30 text-primary border border-primary/40" : "bg-muted/30 text-muted-foreground border border-glass-border"
                  }`}>
                    {el.label}
                  </div>
                ) : el.selector.startsWith("h1") || el.selector.startsWith("div") || el.selector.startsWith("nav") ? (
                  <div className="h-full rounded-lg bg-muted/20 border border-glass-border/50 flex items-center justify-center text-foreground/50">
                    {el.label}
                  </div>
                ) : (
                  <div className="h-full flex flex-col gap-0.5">
                    <span className="text-muted-foreground/60 text-[8px]">{el.label}</span>
                    <div className={`flex-1 rounded-lg border px-2 flex items-center ${
                      el.highlighted ? "border-primary/60 bg-primary/5" : "border-glass-border bg-muted/20"
                    }`}>
                      {el.filled && (
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: "auto" }}
                          className="text-foreground/70 overflow-hidden whitespace-nowrap"
                        >
                          {el.filled}
                        </motion.span>
                      )}
                      {el.highlighted && (
                        <span className="inline-block w-[1px] h-3 bg-primary animate-terminal-blink ml-0.5" />
                      )}
                    </div>
                  </div>
                )}
                {el.highlighted && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[8px] font-mono border border-primary/30 whitespace-nowrap"
                  >
                    → {el.selector}
                  </motion.div>
                )}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Cursor */}
        {highlighted && (
          <motion.div
            key={`cursor-${frameIndex}`}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              left: `${highlighted.x + highlighted.w / 2}%`,
              top: `${highlighted.y + highlighted.h / 2 + 8}%`,
            }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute w-3 h-3 z-20 pointer-events-none"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-full h-full drop-shadow-lg">
              <path d="M1 1l5.5 14L8 9l6-1.5L1 1z" fill="hsl(var(--primary))" stroke="hsl(var(--primary-foreground))" strokeWidth="1" />
            </svg>
          </motion.div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-glass-border/30 font-mono text-[9px] text-muted-foreground">
        <span>Frame {frameIndex + 1}/{FRAMES.length}</span>
        {highlighted && <span className="text-primary">Targeting: {highlighted.selector}</span>}
      </div>
    </div>
  );
};
