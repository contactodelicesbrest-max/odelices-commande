import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        haccp: resolve(__dirname, "haccp/index.html"), // => /haccp/ sur Vercel
      },
    },
  },
});
