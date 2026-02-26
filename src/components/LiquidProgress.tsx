import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface LiquidProgressProps {
  value: number;
  label?: string;
  showPercentage?: boolean;
}

export const LiquidProgress = ({ value, label, showPercentage = true }: LiquidProgressProps) => {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDisplayed(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  const circumference = 2 * Math.PI * 42;
  const strokeOffset = circumference - (displayed / 100) * circumference;
  const glowColor = "hsl(var(--primary))";

  return (
    <div className="flex items-center gap-4">
      {/* Circular Progress */}
      <div className="relative w-24 h-24 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background track */}
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="hsl(var(--muted) / 0.3)"
            strokeWidth="6"
          />
          {/* Animated progress arc */}
          <motion.circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
              filter: `drop-shadow(0 0 2px ${glowColor})`,
            }}
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="50%" stopColor="hsl(var(--primary) / 0.6)" />
              <stop offset="100%" stopColor="hsl(var(--primary))" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showPercentage && (
            <motion.span
              key={displayed}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono text-lg font-bold text-foreground"
            >
              {displayed}%
            </motion.span>
          )}
        </div>

      </div>

      {/* Label & status */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {label && (
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </p>
        )}
        <div className="flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: glowColor }}
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <span className="font-mono text-[11px] text-foreground/80">
            {displayed < 30 ? "Warming up..." : displayed < 60 ? "In progress" : displayed < 90 ? "Almost there" : "Finishing up"}
          </span>
        </div>
        {/* Mini linear track */}
        <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${glowColor}, hsl(var(--primary)))` }}
            initial={{ width: 0 }}
            animate={{ width: `${displayed}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
};
