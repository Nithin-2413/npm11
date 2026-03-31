import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Execute from "./pages/Execute";
import Blueprints from "./pages/Blueprints";
import BlueprintEditor from "./pages/BlueprintEditor";
import Reports from "./pages/Reports";
import ReportDetail from "./pages/ReportDetail";
import Network from "./pages/Network";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import Analytics from "./pages/Analytics";
import Schedules from "./pages/Schedules";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Apply theme from localStorage on startup
function useThemeInit() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("npm-settings");
      const theme = saved ? JSON.parse(saved).theme : "dark";
      const root = document.documentElement;
      if (theme === "light") {
        root.classList.add("light");
      } else if (theme === "auto") {
        if (!window.matchMedia("(prefers-color-scheme: dark)").matches) {
          root.classList.add("light");
        }
      }
    } catch {}
  }, []);
}

const App = () => {
  useThemeInit();
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/execute" element={<Execute />} />
              <Route path="/execute/:id" element={<Execute />} />
              <Route path="/blueprints" element={<Blueprints />} />
              <Route path="/blueprints/create" element={<BlueprintEditor />} />
              <Route path="/blueprints/:id/edit" element={<BlueprintEditor />} />
              <Route path="/blueprints/:id/view" element={<BlueprintEditor />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/:id" element={<ReportDetail />} />
              <Route path="/network" element={<Network />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
