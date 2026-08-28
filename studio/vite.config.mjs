import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

// The studio imports the production compiler sources from ../threshold/preprocess
// and the glossary types from ../source/components, so the dev server must be
// allowed to serve files from the whole repo.
export default defineConfig({
  plugins: [react()],
  // Some transitively-imported compiler modules read process.env at module
  // scope (webpack injects it); shim it for Vite.
  define: {
    "process.env": {},
  },
  server: {
    port: 5199,
    fs: { allow: [resolve(here, "../../../..")] },
  },
});
