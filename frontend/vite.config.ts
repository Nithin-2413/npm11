import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envPrefix: ["VITE_", "REACT_APP_"],
  server: {
    host: "::",
    port: 3000,
    allowedHosts: true,
    hmr: false, // Completely disable HMR
    watch: null, // Disable file watching entirely
    middlewareMode: false,
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "ws://localhost:8001",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
