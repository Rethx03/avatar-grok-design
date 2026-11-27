import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Library build.
 *
 * Produces, inside `dist/`:
 *   index.js / index.cjs     React entry (components, hook, presets, actions)
 *   vanilla.js / vanilla.cjs React-free entry (DOM mounting, catalogs, engine)
 *   types/                   bundled type declarations
 *   avatar.css               component stylesheet (copied by build-assets.mjs)
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    minify: false,
    sourcemap: false,
    lib: {
      entry: {
        index: "src/index.ts",
        vanilla: "src/vanilla.ts",
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        format === "es" ? `${entryName}.js` : `${entryName}.cjs`,
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom/client",
      ],
      output: {
        exports: "named",
      },
    },
  },
});
