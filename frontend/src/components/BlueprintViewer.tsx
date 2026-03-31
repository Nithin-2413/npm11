import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface BlueprintStep {
  type: string;
  target: string;
  value?: string;
  status: "done" | "active" | "pending";
  details?: string;
  duration?: string;
}

interface Blueprint {
  id: string;
  name: string;
  steps: BlueprintStep[];
}

const BLUEPRINTS: Blueprint[] = [
  {
    id: "signup_flow_v1",
    name: "signup_flow_v1",
    steps: [
      { type: "navigate", target: "https://app.example.com/signup", status: "done", details: "Page loaded in 1.2s. DOM snapshot captured (3.2KB). Title: 'Sign Up - Example App'", duration: "1.2s" },
      { type: "fill", target: "input#email", value: "{{USER_EMAIL}}", status: "done", details: "Resolved to test_user@example.com. Input validated client-side. No errors.", duration: "0.3s" },
      { type: "fill", target: "input#password", value: "{{PASSWORD}}", status: "done", details: "Password strength: Strong (12 chars). Meets policy requirements.", duration: "0.2s" },
      { type: "select", target: "dropdown#country", value: "United States", status: "done", details: "Dropdown contained 195 options. Matched 'United States' at index 184.", duration: "0.8s" },
      { type: "click", target: "input#terms-checkbox", status: "active", details: "Checkbox state toggling. Waiting for event handler to complete...", duration: "—" },
      { type: "click", target: "button#submit", status: "pending", details: "Queued. Will trigger POST /api/auth/register", duration: "—" },
      { type: "wait_for_url", target: "**/dashboard**", status: "pending", details: "Will wait up to 5000ms for redirect", duration: "—" },
    ],
  },
  {
    id: "login_flow_v1",
    name: "login_flow_v1",
    steps: [
      { type: "navigate", target: "https://app.example.com/login", status: "done", details: "Page loaded in 0.9s. Login form detected.", duration: "0.9s" },
      { type: "fill", target: "input#email", value: "admin@example.com", status: "done", details: "Email field populated. Client validation passed.", duration: "0.2s" },
      { type: "fill", target: "input#password", value: "••••••••", status: "done", details: "Password field populated.", duration: "0.1s" },
      { type: "click", target: "button#login", status: "done", details: "POST /api/auth/login → 200 OK. Session token received.", duration: "0.4s" },
      { type: "wait_for_url", target: "**/dashboard**", status: "done", details: "Redirected in 320ms.", duration: "0.3s" },
    ],
  },
  {
    id: "checkout_flow_v1",
    name: "checkout_flow_v1",
    steps: [
      { type: "navigate", target: "https://app.example.com/cart", status: "done", details: "Cart page loaded. 3 items detected.", duration: "1.1s" },
      { type: "click", target: "button#checkout", status: "done", details: "Checkout initiated. Payment form rendered.", duration: "0.5s" },
      { type: "fill", target: "input#card-number", value: "4242••••••••4242", status: "active", details: "Stripe Elements iframe detected. Filling card number...", duration: "—" },
      { type: "click", target: "button#pay", status: "pending", details: "Queued. Will trigger Stripe payment intent.", duration: "—" },
    ],
  },
];

const statusStyles: Record<string, string> = {
  done: "border-emerald-400/40 bg-emerald-400/5",
  active: "border-primary/60 bg-primary/10",
  pending: "border-glass-border bg-transparent opacity-50",
};

const statusIcon: Record<string, string> = {
  done: "💎",
  active: "🌊",
  pending: "○",
};

export const BlueprintViewer = () => {
  const [activeBlueprint, setActiveBlueprint] = useState(0);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const bp = BLUEPRINTS[activeBlueprint];
  const doneCount = bp.steps.filter((s) => s.status === "done").length;

  return (
    <div className="space-y-2">
      {/* Blueprint selector tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {BLUEPRINTS.map((b, i) => (
          <button
            key={b.id}
            onClick={() => { setActiveBlueprint(i); setExpandedStep(null); }}
            className={`font-mono text-[10px] px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
              i === activeBlueprint
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-glass-border bg-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
          Blueprint: {bp.name}
        </span>
        <span className="font-mono text-[10px] text-primary">{doneCount}/{bp.steps.length} steps</span>
      </div>

      {bp.steps.map((step, i) => (
        <div key={`${bp.id}-${i}`}>
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            onClick={() => setExpandedStep(expandedStep === i ? null : i)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border font-mono text-xs cursor-pointer transition-colors hover:bg-muted/10 ${statusStyles[step.status]} ${expandedStep === i ? "ring-1 ring-primary/30" : ""}`}
          >
            <span className="text-sm">{statusIcon[step.status]}</span>
            <span className="text-glow-purple font-semibold w-20 shrink-0">{step.type}</span>
            <span className="text-foreground/70 truncate">{step.target}</span>
            {step.value && (
              <span className="ml-auto text-primary/80 shrink-0">→ {step.value}</span>
            )}
            <motion.span
              animate={{ rotate: expandedStep === i ? 180 : 0 }}
              className="text-muted-foreground text-[10px] ml-1 shrink-0"
            >
              ▼
            </motion.span>
          </motion.div>

          <AnimatePresence>
            {expandedStep === i && step.details && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="ml-8 mt-1 mb-2 px-3 py-2 rounded-lg border border-glass-border bg-muted/10 font-mono text-[11px] text-muted-foreground space-y-1">
                  <p>{step.details}</p>
                  {step.duration && (
                    <p className="text-primary/60">⏱ Duration: {step.duration}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};
