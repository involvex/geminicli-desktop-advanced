import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// eslint-disable-next-line no-undef
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/geminicli-desktop-advanced/' : '/'),
  resolve: {
    alias: {
      // eslint-disable-next-line no-undef
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
  },
  define: {
    // eslint-disable-next-line no-undef
    __WEB__: JSON.stringify(process.env.GEMINI_DESKTOP_WEB === "true"),
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    proxy: {
      "/api": {
        target: "http://0.0.0.0:1858",
        changeOrigin: true,
      },
      "/api/ws": {
        target: "ws://0.0.0.0:1858",
        changeOrigin: true,
        ws: true,
      },
    },
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
});
