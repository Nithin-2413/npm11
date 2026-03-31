import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

interface LogLine {
  text: string;
  type: "info" | "success" | "error" | "warn" | "system";
  timestamp: string;
}

const typeColors: Record<string, string> = {
  info: "text-primary",
  success: "text-emerald-400",
  error: "text-destructive",
  warn: "text-amber-400",
  system: "text-glow-purple",
};

const typePrefix: Record<string, string> = {
  info: "💧",
  success: "💎",
  error: "❄️",
  warn: "⚠️",
  system: "🔮",
};

const MOCK_LOGS: LogLine[] = [
  { text: "Initializing Neural Glass Agent...", type: "system", timestamp: "00:00.000" },
  { text: "Glass browser environment ready", type: "success", timestamp: "00:01.234" },
  { text: "Crystal Interceptor attached to surface", type: "system", timestamp: "00:01.456" },
  { text: "Navigating to https://app.example.com/signup", type: "info", timestamp: "00:02.100" },
  { text: "Page DOM snapshot captured (3.2KB)", type: "info", timestamp: "00:02.890" },
  { text: "Filling input#email → test_user@example.com", type: "info", timestamp: "00:03.210" },
  { text: "Filling input#password → ••••••••••••", type: "info", timestamp: "00:03.450" },
  { text: "Selecting dropdown#country → \"United States\"", type: "info", timestamp: "00:03.890" },
  { text: "POST /api/auth/register → 422 Unprocessable", type: "error", timestamp: "00:04.100" },
  { text: "Error crystal formed — analyzing through AI glass...", type: "warn", timestamp: "00:04.200" },
  { text: "AI Diagnosis: Missing required field 'terms_accepted'", type: "system", timestamp: "00:05.100" },
  { text: "Retrying with terms checkbox enabled...", type: "info", timestamp: "00:05.500" },
  { text: "Clicking input#terms-checkbox", type: "info", timestamp: "00:05.700" },
  { text: "Clicking button#submit", type: "info", timestamp: "00:05.900" },
  { text: "POST /api/auth/register → 201 Created", type: "success", timestamp: "00:06.300" },
  { text: "Flow crystallized as blueprint: signup_flow_v1", type: "success", timestamp: "00:06.500" },
];

export const TerminalOutput = () => {
  const [visibleLines, setVisibleLines] = useState<LogLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < MOCK_LOGS.length) {
        setVisibleLines((prev) => [...prev, MOCK_LOGS[i]]);
        i++;
      } else {
        // Loop
        i = 0;
        setVisibleLines([]);
      }
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLines]);

  return (
    <div
      ref={scrollRef}
      className="glass-panel-strong p-4 font-mono text-xs leading-relaxed h-[320px] overflow-y-auto scrollbar-thin"
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-glass-border">
        <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-muted-foreground text-[10px]">npm://terminal</span>
      </div>
      {visibleLines.map((line, i) => (
        <motion.div
          key={`${i}-${line.timestamp}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex gap-2 py-0.5"
        >
          <span className="text-muted-foreground shrink-0">[{line.timestamp}]</span>
          <span>{typePrefix[line.type]}</span>
          <span className={typeColors[line.type]}>{line.text}</span>
        </motion.div>
      ))}
      <span className="inline-block w-2 h-4 bg-primary animate-terminal-blink ml-1" />
    </div>
  );
};
