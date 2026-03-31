import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Play, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: "1", type: "success", title: "Execution Complete", message: "signup_flow_v1 finished successfully (7/7 actions)", time: "2m ago", read: false },
  { id: "2", type: "error", title: "Execution Failed", message: "checkout_flow_v1 failed at step 3: card declined", time: "15m ago", read: false },
  { id: "3", type: "warning", title: "Slow Response", message: "API /auth/register took 3.2s (threshold: 2s)", time: "22m ago", read: false },
  { id: "4", type: "info", title: "Blueprint Updated", message: "login_flow_v1 auto-saved to v1.1", time: "1h ago", read: true },
  { id: "5", type: "success", title: "New Record", message: "94.2% success rate — best this month!", time: "2h ago", read: true },
];

const typeConfig = {
  success: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  error: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
};

export const NotificationPanel = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center text-[8px] font-bold text-accent-foreground"
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-glass-border shadow-2xl z-50 overflow-hidden"
              style={{ background: "hsl(var(--glass-bg))", backdropFilter: "blur(40px)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
                <span className="font-mono text-xs font-semibold text-foreground">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="font-mono text-[9px] text-primary hover:text-primary/80 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
                    No notifications
                  </div>
                ) : notifications.map((n) => {
                  const config = typeConfig[n.type];
                  const Icon = config.icon;
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      onClick={() => markRead(n.id)}
                      className={`px-4 py-3 border-b border-glass-border/30 hover:bg-muted/10 transition-colors cursor-pointer ${
                        !n.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg ${config.bg} ${config.border} border shrink-0 mt-0.5`}>
                          <Icon className={`w-3 h-3 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold text-foreground">{n.title}</span>
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                          </div>
                          <p className="font-mono text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          <span className="font-mono text-[9px] text-muted-foreground/60 mt-1 block">{n.time}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
