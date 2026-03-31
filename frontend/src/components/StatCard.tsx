import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  subtext?: string;
  color: "cyan" | "purple" | "pink" | "green" | "blue" | "orange" | "violet" | "blueberry" | "pistachio";
}

const colorMap: Record<string, string> = {
  cyan: "from-glow-cyan/20 to-transparent border-glow-cyan/30 text-primary",
  purple: "from-theme-purple/20 to-transparent border-theme-purple/30 text-theme-purple",
  pink: "from-theme-pink/20 to-transparent border-theme-pink/30 text-theme-pink",
  green: "from-theme-green/20 to-transparent border-theme-green/30 text-theme-green",
  blue: "from-theme-blue/20 to-transparent border-theme-blue/30 text-theme-blue",
  orange: "from-theme-orange/20 to-transparent border-theme-orange/30 text-theme-orange",
  violet: "from-theme-violet/20 to-transparent border-theme-violet/30 text-theme-violet",
  blueberry: "from-theme-blueberry/20 to-transparent border-theme-blueberry/30 text-theme-blueberry",
  pistachio: "from-theme-pistachio/20 to-transparent border-theme-pistachio/30 text-theme-pistachio",
};

export const StatCard = ({ icon, label, value, subtext, color }: StatCardProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [animating, setAnimating] = useState(false);

  // Animate number on mount
  useEffect(() => {
    const numMatch = value.match(/^([\d,]+\.?\d*)/);
    if (!numMatch) return;

    const target = parseFloat(numMatch[1].replace(/,/g, ""));
    const suffix = value.slice(numMatch[1].length);
    const hasCommas = numMatch[1].includes(",");
    const decimals = numMatch[1].includes(".") ? numMatch[1].split(".")[1].length : 0;
    const duration = 1200;
    const steps = 30;
    const stepTime = duration / steps;
    let step = 0;

    setAnimating(true);
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
      const current = target * eased;
      let formatted = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toString();
      if (hasCommas) {
        const parts = formatted.split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        formatted = parts.join(".");
      }
      setDisplayValue(formatted + suffix);
      if (step >= steps) {
        clearInterval(timer);
        setDisplayValue(value);
        setAnimating(false);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className={`glass-panel p-4 bg-gradient-to-br ${colorMap[color]} cursor-pointer select-none`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground mb-1">
            {label}
          </p>
          <p className={`text-2xl font-bold font-mono transition-all ${animating ? "opacity-80" : ""}`}>
            {displayValue}
          </p>
          {subtext && (
            <p className="text-[10px] text-muted-foreground mt-1">{subtext}</p>
          )}
        </div>
        <motion.span
          className="text-2xl"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {icon}
        </motion.span>
      </div>
    </motion.div>
  );
};
