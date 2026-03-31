import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { LiquidProgress } from "@/components/LiquidProgress";
import { TerminalOutput } from "@/components/TerminalOutput";
import { NetworkMonitor } from "@/components/NetworkMonitor";
import { BlueprintViewer } from "@/components/BlueprintViewer";
import { StatCard } from "@/components/StatCard";
import { AIDiagnosis } from "@/components/AIDiagnosis";
import { CommandBar } from "@/components/CommandBar";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-glow-cyan/5 blur-[120px] animate-pulse-glow" />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-glow-purple/5 blur-[120px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-glow-pink/5 blur-[120px] animate-pulse-glow" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center space-y-3 mb-10"
        >
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl animate-float">🌊</span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight gradient-text">
              NPM
            </h1>
          </div>
          <p className="font-mono text-sm text-muted-foreground tracking-widest uppercase">
            NextSure Prime Matrix — Glassmorphic QA Automation
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-emerald-400">System Online</span>
            <span className="text-muted-foreground">•</span>
            <Link
              to="/history"
              className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              📜 History
            </Link>
          </div>
        </motion.header>

        {/* Command Bar */}
        <CommandBar />

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon="💧" label="Actions" value="142" subtext="Last 24h" color="cyan" />
          <StatCard icon="💎" label="Blueprints" value="8" subtext="Crystallized" color="purple" />
          <StatCard icon="⚡" label="Avg Speed" value="0.8s" subtext="Per action" color="pink" />
          <StatCard icon="✓" label="Pass Rate" value="94%" subtext="+2% this week" color="green" />
        </div>

        {/* Main progress */}
        <GlassPanel title="Execution Flow" icon="🌊" glow="cyan" delay={0.2}>
          <div className="space-y-4">
            <LiquidProgress value={100} label="Navigate → signup page" />
            <LiquidProgress value={100} label="Fill → email, password" />
            <LiquidProgress value={100} label="Select → country dropdown" />
            <LiquidProgress value={72} label="Click → terms & submit" />
            <LiquidProgress value={0} label="Verify → dashboard redirect" />
          </div>
        </GlassPanel>

        {/* Two column layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Terminal */}
          <GlassPanel title="Live Terminal" icon="🖥️" glow="cyan" delay={0.3}>
            <TerminalOutput />
          </GlassPanel>

          {/* Blueprint */}
          <GlassPanel title="Active Blueprint" icon="📐" glow="purple" delay={0.4}>
            <BlueprintViewer />
          </GlassPanel>
        </div>

        {/* Network + AI */}
        <div className="grid md:grid-cols-2 gap-6">
          <GlassPanel title="Network Crystal" icon="🔮" glow="cyan" delay={0.5}>
            <NetworkMonitor />
          </GlassPanel>

          <GlassPanel title="AI Diagnosis" icon="🧠" glow="pink" delay={0.6}>
            <AIDiagnosis />
          </GlassPanel>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center py-6 font-mono text-[10px] text-muted-foreground tracking-widest uppercase"
        >
          Liquid Intelligence • Crystal Clarity • Neural Precision
        </motion.footer>
      </div>
    </div>
  );
};

export default Index;
