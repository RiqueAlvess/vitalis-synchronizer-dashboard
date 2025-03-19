
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/test-connection': {
        target: 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/test-connection/, '/test-connection'),
        secure: true,
        headers: {
          'Content-Type': 'application/json',
        }
      },
      '/api/api-config': {
        target: 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/api-config/, '/api-config'),
        secure: true,
        headers: {
          'Content-Type': 'application/json',
        }
      },
      '/api': {
        target: 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
