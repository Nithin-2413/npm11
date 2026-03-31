import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envPrefix: ["VITE_", "REACT_APP_"],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['framer-motion', 'lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
    target: 'es2015',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: [],
  },
  server: {
    host: "::",
    port: 3000,
    strictPort: true,
    allowedHosts: [
      '.emergentagent.com',
      '.emergentcf.cloud',
      'execution-engine-v2.cluster-0.preview.emergentcf.cloud',
      'localhost',
    ],
    hmr: false,
    watch: {
      ignored: ['**/*'],
      useFsEvents: false,
      usePolling: false,
    },
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
