import { cn } from "@/lib/utils";

export type ActionType =
  | "navigate" | "fill" | "click" | "select" | "wait" | "assert" | "screenshot" | "custom"
  | "upload" | "scroll" | "hover" | "drag" | "keypress" | "checkbox" | "radio"
  | "textarea" | "condition" | "loop" | "function" | "api" | "delay" | "extract";

const ACTION_MAP: Record<ActionType, { color: string; icon: string }> = {
  navigate: { color: "text-primary border-primary/30 bg-primary/10", icon: "🧭" },
  fill: { color: "text-secondary border-secondary/30 bg-secondary/10", icon: "✏️" },
  click: { color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10", icon: "👆" },
  select: { color: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: "🔽" },
  wait: { color: "text-muted-foreground border-glass-border bg-muted/10", icon: "⏳" },
  assert: { color: "text-accent border-accent/30 bg-accent/10", icon: "✓" },
  screenshot: { color: "text-primary border-primary/30 bg-primary/10", icon: "📸" },
  upload: { color: "text-violet-400 border-violet-400/30 bg-violet-400/10", icon: "📁" },
  scroll: { color: "text-sky-400 border-sky-400/30 bg-sky-400/10", icon: "↕" },
  hover: { color: "text-pink-400 border-pink-400/30 bg-pink-400/10", icon: "🖱" },
  drag: { color: "text-orange-400 border-orange-400/30 bg-orange-400/10", icon: "✋" },
  keypress: { color: "text-teal-400 border-teal-400/30 bg-teal-400/10", icon: "⌨" },
  checkbox: { color: "text-lime-400 border-lime-400/30 bg-lime-400/10", icon: "☑" },
  radio: { color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10", icon: "◉" },
  textarea: { color: "text-indigo-400 border-indigo-400/30 bg-indigo-400/10", icon: "📝" },
  condition: { color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10", icon: "🔀" },
  loop: { color: "text-rose-400 border-rose-400/30 bg-rose-400/10", icon: "🔁" },
  function: { color: "text-fuchsia-400 border-fuchsia-400/30 bg-fuchsia-400/10", icon: "ƒ" },
  api: { color: "text-emerald-300 border-emerald-300/30 bg-emerald-300/10", icon: "🌐" },
  delay: { color: "text-stone-400 border-stone-400/30 bg-stone-400/10", icon: "⏱" },
  extract: { color: "text-amber-300 border-amber-300/30 bg-amber-300/10", icon: "🔍" },
  custom: { color: "text-muted-foreground border-glass-border bg-muted/10", icon: "⚙️" },
};

interface ActionBadgeProps {
  type: ActionType;
  className?: string;
}

export const ActionBadge = ({ type, className }: ActionBadgeProps) => {
  const config = ACTION_MAP[type] || ACTION_MAP.custom;
  return (
    <span className={cn(
      "font-mono text-[10px] font-semibold px-2 py-0.5 rounded border inline-flex items-center gap-1",
      config.color,
      className
    )}>
      <span>{config.icon}</span>
      <span className="uppercase">{type}</span>
    </span>
  );
};
