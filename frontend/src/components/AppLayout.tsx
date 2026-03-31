import { useState, useEffect, useRef } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationPanel } from "@/components/NotificationPanel";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { SystemPulse } from "@/components/SystemPulse";
import { AnimatedAvatar, AvatarAnimal, getAvatarEmoji } from "@/components/AnimatedAvatar";
import {
  LayoutDashboard, Play, FileCode2, FileText,
  Settings, Menu, Search,
  ChevronLeft, Keyboard, User, LogOut, Sun, Moon,
  BarChart2, Clock, Globe, Wifi
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", shortcut: "G D", color: "theme-blue" },
  { label: "Execute", icon: Play, path: "/execute", shortcut: "G E", color: "theme-green" },
  { label: "Blueprints", icon: FileCode2, path: "/blueprints", shortcut: "G B", color: "theme-violet" },
  { label: "Reports", icon: FileText, path: "/reports", shortcut: "G R", color: "theme-orange" },
  { label: "Network", icon: Wifi, path: "/network", shortcut: "G N", color: "theme-cyan" },
  { label: "Analytics", icon: BarChart2, path: "/analytics", shortcut: "G A", color: "theme-pink" },
  { label: "Schedules", icon: Clock, path: "/schedules", shortcut: "G C", color: "theme-amber" },
  { label: "Settings", icon: Settings, path: "/settings", shortcut: "G S", color: "theme-pistachio" },
];

const NAV_COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  "theme-blue":      { bg: "bg-theme-blue/10",      text: "text-theme-blue",      border: "border-theme-blue/20",      glow: "" },
  "theme-green":     { bg: "bg-theme-green/10",     text: "text-theme-green",     border: "border-theme-green/20",     glow: "" },
  "theme-violet":    { bg: "bg-theme-violet/10",    text: "text-theme-violet",    border: "border-theme-violet/20",    glow: "" },
  "theme-orange":    { bg: "bg-theme-orange/10",    text: "text-theme-orange",    border: "border-theme-orange/20",    glow: "" },
  "theme-pink":      { bg: "bg-theme-pink/10",      text: "text-theme-pink",      border: "border-theme-pink/20",      glow: "" },
  "theme-pistachio": { bg: "bg-theme-pistachio/10", text: "text-theme-pistachio", border: "border-theme-pistachio/20", glow: "" },
  "theme-blueberry": { bg: "bg-theme-blueberry/10", text: "text-theme-blueberry", border: "border-theme-blueberry/20", glow: "" },
  "theme-cyan":      { bg: "bg-primary/10",         text: "text-primary",         border: "border-primary/20",         glow: "" },
  "theme-amber":     { bg: "bg-amber-400/10",       text: "text-amber-400",       border: "border-amber-400/20",       glow: "" },
};

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => !document.documentElement.classList.contains("light"));
  const profileRef = useRef<HTMLDivElement>(null);
  const [avatar, setAvatar] = useState<AvatarAnimal>(() => {
    return (localStorage.getItem("npm_avatar") as AvatarAnimal) || "lion";
  });

  // Listen for avatar changes from Profile page
  useEffect(() => {
    const handler = (e: Event) => setAvatar((e as CustomEvent).detail);
    window.addEventListener("avatar-changed", handler);
    return () => window.removeEventListener("avatar-changed", handler);
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const goLight = !root.classList.contains("light");
    if (goLight) root.classList.add("light");
    else root.classList.remove("light");
    setIsDark(!goLight);
    const newTheme = goLight ? "light" : "dark";
    try {
      const saved = localStorage.getItem("npm-settings");
      const settings = saved ? JSON.parse(saved) : {};
      settings.theme = newTheme;
      localStorage.setItem("npm-settings", JSON.stringify(settings));
    } catch {}
    window.dispatchEvent(new CustomEvent("theme-changed", { detail: newTheme }));
  };

  // Listen for theme changes from Settings page
  useEffect(() => {
    const handler = (e: Event) => {
      const theme = (e as CustomEvent).detail as string;
      setIsDark(theme !== "light");
    };
    window.addEventListener("theme-changed", handler);
    return () => window.removeEventListener("theme-changed", handler);
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    navigate("/login");
  };

  // Keyboard navigation shortcuts (G + key)
  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        gPressed = true;
        clearTimeout(gTimeout);
        gTimeout = setTimeout(() => { gPressed = false; }, 500);
        return;
      }

      if (gPressed) {
        gPressed = false;
        const map: Record<string, string> = { d: "/", e: "/execute", b: "/blueprints", r: "/reports", s: "/settings" };
        if (map[e.key]) {
          e.preventDefault();
          navigate(map[e.key]);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); clearTimeout(gTimeout); };
  }, [navigate]);


  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Global modals */}
      <GlobalSearchModal />
      <KeyboardShortcutsModal />

      {/* Soft ambient background — subtle, not distracting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-glow-cyan/3 blur-[150px] animate-pulse-glow" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full bg-glow-purple/3 blur-[150px] animate-pulse-glow" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-[-15%] left-[25%] w-[450px] h-[450px] rounded-full bg-glow-pink/3 blur-[150px] animate-pulse-glow" style={{ animationDelay: "4s" }} />
      </div>

      {/* Sidebar — macOS Finder style */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r overflow-hidden"
            style={{
              borderColor: "hsl(var(--glass-border) / 0.3)",
              background: "linear-gradient(180deg, hsl(var(--glass-bg) / 0.15) 0%, hsl(var(--glass-bg) / 0.08) 100%)",
              backdropFilter: "blur(80px) saturate(1.4) brightness(0.97)",
              WebkitBackdropFilter: "blur(80px) saturate(1.4) brightness(0.97)",
              boxShadow: "inset 1px 0 0 0 hsl(0 0% 100% / 0.08), inset 0 1px 0 0 hsl(0 0% 100% / 0.06), 4px 0 30px -4px hsl(0 0% 0% / 0.15)",
            }}
          >
            {/* NPM Logo + collapse */}
            <div className="p-4 flex items-center border-b" style={{ borderColor: "hsl(var(--glass-border) / 0.3)" }}>
              <div className="flex-1 flex flex-col items-center gap-1">
                <span className="text-2xl animate-float">🌊</span>
                <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent" style={{ fontFamily: "'Sen', sans-serif", backgroundImage: "linear-gradient(135deg, #7a5c12, #b8942e, #e2c56d, #f5e2a0, #e2c56d, #b8942e, #7a5c12)", backgroundSize: "300% auto", animation: "gold-shine 10s linear infinite" }}>NPM</h1>
                <p className="text-[8px] text-muted-foreground tracking-widest uppercase leading-tight text-center" style={{ fontFamily: "'Sen', sans-serif" }}>NextSure Prime<br/>Matrix</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-[10px] text-[12px] tracking-tight transition-all duration-200 group ${
                      isActive
                        ? `${NAV_COLOR_CLASSES[item.color].text} ${NAV_COLOR_CLASSES[item.color].border} border font-medium`
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/15 border border-transparent"
                    }`}
                    style={isActive ? {
                      background: `hsl(var(--glass-bg) / 0.6)`,
                      backdropFilter: "blur(12px)",
                      boxShadow: "0 1px 3px -1px hsl(var(--background) / 0.3), inset 0 0.5px 0 0 hsl(var(--foreground) / 0.04)"
                    } : undefined}
                  >
                    <item.icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
                    <span className="flex-1" style={{ fontFamily: "'Sen', sans-serif" }}>{item.label}</span>
                    {item.shortcut && (
                      <span className="font-mono text-[8px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.shortcut}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* System Pulse */}
            <div className="px-4 py-3 border-t" style={{ borderColor: "hsl(var(--glass-border) / 0.3)" }}>
              <SystemPulse />
            </div>

            {/* Bottom Branding */}
            <div className="p-4 border-t" style={{ borderColor: "hsl(var(--glass-border) / 0.3)" }}>
              <div className="text-center">
                <h2 className="text-sm font-black tracking-tight bg-clip-text text-transparent" style={{ fontFamily: "'Sen', sans-serif", backgroundImage: "linear-gradient(135deg, #7a5c12, #b8942e, #e2c56d, #f5e2a0, #e2c56d, #b8942e, #7a5c12)", backgroundSize: "300% auto", animation: "gold-shine 10s linear infinite" }}>LUMEN</h2>
                <p className="text-[7px] text-muted-foreground tracking-widest uppercase" style={{ fontFamily: "'Sen', sans-serif" }}>Lumen Technologies</p>
                <p className="font-mono text-[8px] text-muted-foreground/50 mt-1">v2.4.1</p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] relative z-10 ${sidebarOpen ? "ml-[240px]" : "ml-0"}`}>
        {/* Top header — macOS toolbar style */}
        <header className="sticky top-0 z-30 border-b px-5 py-2.5 flex items-center gap-3"
          style={{
            borderColor: "hsl(var(--glass-border) / 0.2)",
            background: "hsl(var(--glass-bg) / 0.3)",
            backdropFilter: "blur(50px) saturate(2)",
            WebkitBackdropFilter: "blur(50px) saturate(2)",
          }}
        >
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/20"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          {/* Search — now opens modal */}
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("open-search"));
              }}
              className="w-full max-w-xs flex items-center gap-2 px-3 py-1.5 rounded-xl text-left group transition-all duration-300"
              style={{
                background: "hsl(var(--glass-bg) / 0.3)",
                backdropFilter: "blur(24px)",
                border: "1px solid hsl(var(--glass-border) / 0.35)",
                boxShadow: "inset 0 1px 0 0 hsl(0 0% 100% / 0.08), 0 2px 8px -2px hsl(0 0% 0% / 0.15)",
              }}
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span className="flex-1 text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" style={{ fontFamily: "'Sen', sans-serif" }}>
                Search...
              </span>
              <kbd className="text-[9px] px-1.5 py-0.5 rounded-md text-muted-foreground/50" style={{ fontFamily: "'Sen', sans-serif", border: "1px solid hsl(var(--glass-border) / 0.25)", background: "hsl(var(--glass-bg) / 0.2)" }}>⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {/* Keyboard shortcuts hint */}
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
              title="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <NotificationPanel />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="relative w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors flex items-center justify-center"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={isDark ? "moon" : "sun"}
                  initial={{ scale: 0, rotate: -180, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, rotate: 180, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute"
                >
                  {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </motion.div>
              </AnimatePresence>
            </button>

            {/* Profile Dropdown */}
            <div ref={profileRef} className="relative pl-2 ml-1 border-l border-glass-border">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <AnimatedAvatar animal={avatar} size="sm" />
                <span className="text-xs text-muted-foreground hidden sm:inline" style={{ fontFamily: "'Sen', sans-serif" }}>
                  {((user?.name || "user").length > 7 ? (user?.name || "user").slice(0, 7) + "…" : (user?.name || "user"))}
                </span>
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-44 rounded-xl overflow-hidden z-50"
                    style={{
                      background: "hsl(var(--glass-bg) / 0.85)",
                      backdropFilter: "blur(24px) saturate(1.6)",
                      border: "1px solid hsl(var(--glass-border) / 0.4)",
                      boxShadow: "0 8px 32px -8px hsl(0 0% 0% / 0.3), inset 0 1px 0 0 hsl(0 0% 100% / 0.06)",
                    }}
                  >
                    <Link
                      to="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 font-mono text-[11px] text-foreground hover:bg-muted/20 transition-colors"
                    >
                      <User className="w-3.5 h-3.5" /> My Profile
                    </Link>
                    <div className="border-t" style={{ borderColor: "hsl(var(--glass-border) / 0.3)" }} />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 font-mono text-[11px] text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
