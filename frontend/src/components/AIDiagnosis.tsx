import { motion } from "framer-motion";

const DIAGNOSES = [
  {
    level: "Critical",
    levelColor: "text-destructive",
    title: "Missing Required Field",
    component: "AuthController.register()",
    description: "POST /api/auth/register returned 422. The 'terms_accepted' boolean field is required but was not included in the request payload.",
    fix: "Add checkbox interaction for #terms-checkbox before form submission.",
    timestamp: "00:04.200",
  },
  {
    level: "Low",
    levelColor: "text-primary",
    title: "Slow Response Detected",
    component: "POST /api/auth/register",
    description: "Response took 340ms which exceeds the 200ms threshold. Database query optimization recommended.",
    fix: "Add index on users.email column for faster uniqueness check.",
    timestamp: "00:04.500",
  },
];

export const AIDiagnosis = () => {
  return (
    <div className="space-y-3">
      {DIAGNOSES.map((d, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.2 }}
          className="glass-panel-strong p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔮</span>
              <span className="font-mono text-xs font-semibold text-foreground">{d.title}</span>
            </div>
            <span className={`font-mono text-[10px] font-bold ${d.levelColor}`}>{d.level}</span>
          </div>

          <div className="font-mono text-[11px] text-muted-foreground space-y-1">
            <p>
              <span className="text-glow-purple">Component:</span> {d.component}
            </p>
            <p>
              <span className="text-primary">🎯 Root Cause:</span> {d.description}
            </p>
            <p>
              <span className="text-emerald-400">💡 Fix:</span> {d.fix}
            </p>
          </div>

          <div className="text-right">
            <span className="font-mono text-[9px] text-muted-foreground">{d.timestamp}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
