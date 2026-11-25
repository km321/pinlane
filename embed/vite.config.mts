import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      name: "Pinlane",
      formats: ["iife"],
      fileName: () => "embed.js",
    },
    outDir: path.resolve(__dirname, "../public"),
    emptyOutDir: false,
    minify: true,
    sourcemap: false,
  },
});
