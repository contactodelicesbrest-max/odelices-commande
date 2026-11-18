import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    // Compatible avec les anciennes tablettes (Android 5.1, ancien moteur web) :
    // tout le code est converti et complété pour les vieux navigateurs.
    legacy({ targets: ["android >= 5", "chrome >= 37"], renderModernChunks: false }),
  ],
  build: { chunkSizeWarningLimit: 3000 },
});
