import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

// TODO: Replace this placeholder with real DB-based auth calls
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for persisted session
    const stored = localStorage.getItem("npm_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // TODO: Replace with actual API call to your DB auth endpoint
    // e.g., const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!email || !password) throw new Error("Email and password are required");

    // Placeholder: accept any credentials for now
    const mockUser: User = {
      id: crypto.randomUUID(),
      email,
      name: email.split("@")[0],
    };
    setUser(mockUser);
    localStorage.setItem("npm_user", JSON.stringify(mockUser));
  };

  const signup = async (name: string, email: string, password: string) => {
    // TODO: Replace with actual API call to your DB auth endpoint
    if (!name || !email || !password) throw new Error("All fields are required");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");

    const mockUser: User = {
      id: crypto.randomUUID(),
      email,
      name,
    };
    setUser(mockUser);
    localStorage.setItem("npm_user", JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("npm_user");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
