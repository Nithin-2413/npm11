import { ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  maxWidth?: string;
}

export const GlassModal = ({
  open,
  onClose,
  children,
  title,
  subtitle,
  maxWidth = "max-w-3xl",
}: GlassModalProps) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop - dimmed but NO blur so background stays visible */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />

          {/* Glass Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`relative z-10 w-full ${maxWidth} max-h-[85vh] flex flex-col rounded-2xl`}
            style={{
              background: "hsl(var(--background) / 0.55)",
              backdropFilter: "blur(48px) saturate(1.6)",
              WebkitBackdropFilter: "blur(48px) saturate(1.6)",
              border: "1px solid hsl(var(--foreground) / 0.08)",
              boxShadow:
                "0 0 0 1px hsl(var(--foreground) / 0.04) inset, " +
                "0 24px 80px -12px hsl(var(--primary) / 0.12), " +
                "0 8px 24px -4px rgba(0,0,0,0.3)",
            }}
          >
            {/* Top highlight edge */}
            <div
              className="absolute inset-x-0 top-0 h-px rounded-t-2xl pointer-events-none"
              style={{
                background: "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.12) 30%, hsl(var(--foreground) / 0.12) 70%, transparent)",
              }}
            />

            {/* Header */}
            {(title || subtitle) && (
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[hsl(var(--foreground)/0.06)]">
                <div>
                  {title && (
                    <h2 className="font-mono text-base font-bold text-foreground tracking-tight">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Close button when no header */}
            {!title && !subtitle && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Content with scroll */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6">
                {children}
              </div>
            </ScrollArea>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
