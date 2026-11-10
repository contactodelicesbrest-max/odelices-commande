import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Build de l'appli HACCP seule (utilisée pour l'APK Android via Capacitor).
export default defineConfig({
  root: resolve(__dirname, "haccp"),
  base: "./",
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  build: { outDir: resolve(__dirname, "dist-haccp"), emptyOutDir: true },
});
