import { cn } from "@/lib/utils";

export type StatusType = "success" | "failure" | "running" | "pending" | "warning" | "partial";

const STATUS_MAP: Record<StatusType, { label: string; icon: string; className: string }> = {
  success: { label: "Success", icon: "", className: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  failure: { label: "Failed", icon: "", className: "text-destructive border-destructive/30 bg-destructive/10" },
  running: { label: "Running", icon: "", className: "text-primary border-primary/30 bg-primary/10 animate-pulse" },
  pending: { label: "Pending", icon: "", className: "text-muted-foreground border-glass-border bg-muted/10" },
  warning: { label: "Warning", icon: "", className: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  partial: { label: "Partial", icon: "", className: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const StatusBadge = ({ status, className, size = "sm" }: StatusBadgeProps) => {
  const config = STATUS_MAP[status];
  const sizeClasses = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-3 py-1",
    lg: "text-sm px-4 py-1.5",
  };

  return (
    <span className={cn(
      "font-mono font-semibold rounded-lg border inline-flex items-center gap-1",
      config.className,
      sizeClasses[size],
      className
    )}>
      <span>{config.label}</span>
    </span>
  );
};
