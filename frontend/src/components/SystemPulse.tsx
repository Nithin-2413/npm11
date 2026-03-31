import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, ShieldCheck, Repeat, Activity, Zap, BarChart3 } from "lucide-react";

interface SystemPulseProps {
  className?: string;
}

const generateSparkData = (count: number, min: number, max: number) =>
  Array.from({ length: count }, () => Math.round(min + Math.random() * (max - min)));

const MiniBarChart = ({ data, color, maxVal }: { data: number[]; color: string; maxVal: number }) => (
  <div className="flex items-end gap-[2px] h-8">
    {data.map((v, i) => (
      <motion.div
        key={i}
        className={`w-[4px] rounded-sm ${color}`}
        initial={{ height: 0 }}
        animate={{ height: `${(v / maxVal) * 100}%` }}
        transition={{ duration: 0.4, delay: i * 0.03 }}
      />
    ))}
  </div>
);

export const SystemPulse = ({ className = "" }: SystemPulseProps) => {
  const [vpnConnected, setVpnConnected] = useState(true);
  const [stats, setStats] = useState({
    blueprintsRun: 47,
    successRate: 94,
    avgSpeed: 3.2,
    iterations: 23,
  });

  const [chartData, setChartData] = useState({
    runs: generateSparkData(12, 2, 12),
    success: generateSparkData(12, 70, 100),
    speed: generateSparkData(12, 1, 6),
    iterations: generateSparkData(12, 5, 30),
  });

  // Simulate periodic updates
  useEffect(() => {
    const timer = setInterval(() => {
      setStats(prev => ({
        blueprintsRun: prev.blueprintsRun + Math.floor(Math.random() * 3),
        successRate: Math.min(100, Math.max(75, prev.successRate + (Math.random() - 0.5) * 4)),
        avgSpeed: Math.max(0.5, +(prev.avgSpeed + (Math.random() - 0.5) * 0.8).toFixed(1)),
        iterations: Math.max(1, prev.iterations + Math.floor(Math.random() * 3)),
      }));
      setChartData(prev => ({
        runs: [...prev.runs.slice(1), Math.round(2 + Math.random() * 10)],
        success: [...prev.success.slice(1), Math.round(70 + Math.random() * 30)],
        speed: [...prev.speed.slice(1), Math.round(1 + Math.random() * 5)],
        iterations: [...prev.iterations.slice(1), Math.round(5 + Math.random() * 25)],
      }));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const miniStats = useMemo(() => [
    {
      label: "Runs",
      value: stats.blueprintsRun,
      suffix: "",
      icon: BarChart3,
      color: "bg-primary",
      data: chartData.runs,
      max: 14,
    },
    {
      label: "Success",
      value: Math.round(stats.successRate),
      suffix: "%",
      icon: Activity,
      color: "bg-emerald-400",
      data: chartData.success,
      max: 100,
    },
    {
      label: "Avg Speed",
      value: stats.avgSpeed,
      suffix: "s",
      icon: Zap,
      color: "bg-amber-400",
      data: chartData.speed,
      max: 7,
    },
    {
      label: "Iterations",
      value: stats.iterations,
      suffix: "",
      icon: Repeat,
      color: "bg-violet-400",
      data: chartData.iterations,
      max: 35,
    },
  ], [stats, chartData]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* VPN Status */}
      <button
        onClick={() => setVpnConnected(p => !p)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
          vpnConnected
            ? "border-emerald-400/30 bg-emerald-400/5 hover:bg-emerald-400/10"
            : "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
        }`}
      >
        {vpnConnected ? (
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        ) : (
          <Shield className="w-4 h-4 text-destructive" />
        )}
        <div className="flex-1 text-left">
          <div className="font-mono text-[10px] font-semibold text-foreground/90">
            VPN {vpnConnected ? "Connected" : "Disconnected"}
          </div>
          <div className="font-mono text-[8px] text-muted-foreground">
            {vpnConnected ? "Tunnel active — traffic encrypted" : "Click to reconnect"}
          </div>
        </div>
        <span
          className={`w-2 h-2 rounded-full ${
            vpnConnected ? "bg-emerald-400 animate-pulse" : "bg-destructive"
          }`}
        />
      </button>

      {/* Mini Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        {miniStats.map(({ label, value, suffix, icon: Icon, color, data, max }) => (
          <div
            key={label}
            className="rounded-xl border border-glass-border bg-[hsl(var(--glass-bg))] p-2.5 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <Icon className="w-3 h-3 text-muted-foreground" />
              <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                {label}
              </span>
            </div>
            <MiniBarChart data={data} color={color} maxVal={max} />
            <div className="font-mono text-sm font-bold text-foreground/90 tracking-tight">
              {value}
              <span className="text-[9px] text-muted-foreground font-normal ml-0.5">{suffix}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
