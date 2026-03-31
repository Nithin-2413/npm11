import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  title?: string;
  icon?: string;
  glow?: "cyan" | "purple" | "pink" | "none";
  className?: string;
  delay?: number;
}

const glowMap = {
  cyan: "glass-glow-cyan",
  purple: "glass-glow-purple",
  pink: "glass-glow-pink",
  none: "",
};

export const GlassPanel = ({
  children,
  title,
  icon,
  glow = "cyan",
  className = "",
  delay = 0,
}: GlassPanelProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={`glass-panel ${glowMap[glow]} p-5 ${className}`}
    >
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {icon && <span className="text-lg">{icon}</span>}
          <h3 className="font-mono text-sm font-semibold tracking-wider uppercase text-primary">
            {title}
          </h3>
          <div className="flex-1 h-px bg-gradient-to-r from-primary/30 to-transparent" />
        </div>
      )}
      {children}
    </motion.div>
  );
};
