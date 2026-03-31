import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, LogIn, UserPlus, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      if (isSignup) {
        navigate("/onboarding");
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] animate-pulse-glow" />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-secondary/5 blur-[120px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-accent/5 blur-[120px] animate-pulse-glow" style={{ animationDelay: "2s" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-4xl animate-float inline-block">🌊</span>
          <h1 className="text-2xl font-black tracking-tight gradient-text mt-3" style={{ fontFamily: "'Sen', sans-serif" }}>LUMEN</h1>
          <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase mt-1">
            Lumen Technologies
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel-strong p-8 rounded-2xl">
          {/* Toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-muted/30 mb-6">
            <button
              onClick={() => { setIsSignup(false); setError(""); }}
              className={`flex-1 py-2 px-4 rounded-lg font-mono text-xs transition-all ${
                !isSignup ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground"
              }`}
            >
              <LogIn className="w-3.5 h-3.5 inline mr-1.5" />
              Sign In
            </button>
            <button
              onClick={() => { setIsSignup(true); setError(""); }}
              className={`flex-1 py-2 px-4 rounded-lg font-mono text-xs transition-all ${
                isSignup ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 inline mr-1.5" />
              Sign Up
            </button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-xl border border-destructive/30 bg-destructive/10 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="font-mono text-xs text-destructive">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name (signup only) */}
            <AnimatePresence>
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-2.5 rounded-xl border border-glass-border bg-muted/20 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                    required={isSignup}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@lumen.dev"
                className="w-full px-4 py-2.5 rounded-xl border border-glass-border bg-muted/20 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-glass-border bg-muted/20 font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors overflow-hidden"
                >
                  <motion.div
                    key={showPassword ? "open" : "closed"}
                    initial={{ clipPath: "inset(50% 0 50% 0)" }}
                    animate={{ clipPath: "inset(0% 0 0% 0)" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </motion.div>
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-mono text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-foreground text-background hover:opacity-90 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-background border-t-transparent animate-spin" />
                  {isSignup ? "Creating Account..." : "Signing In..."}
                </span>
              ) : (
                isSignup ? "Create Account" : "Sign In"
              )}
            </button>
          </form>

          {/* Footer hint */}
          <p className="font-mono text-[10px] text-muted-foreground text-center mt-6">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => { setIsSignup(!isSignup); setError(""); }}
              className="text-primary hover:underline"
            >
              {isSignup ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>

        <div className="text-center mt-6">
          <h2 className="text-sm font-black tracking-tight bg-clip-text text-transparent" style={{ fontFamily: "'Sen', sans-serif", backgroundImage: "linear-gradient(135deg, #7a5c12, #b8942e, #e2c56d, #f5e2a0, #e2c56d, #b8942e, #7a5c12)", backgroundSize: "300% auto", animation: "gold-shine 10s linear infinite" }}>LUMEN</h2>
          <p className="text-[7px] text-muted-foreground tracking-widest uppercase" style={{ fontFamily: "'Sen', sans-serif" }}>Lumen Technologies</p>
          <p className="font-mono text-[8px] text-muted-foreground/50 mt-1">v2.4.1</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
