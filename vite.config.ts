import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// base './' keeps every emitted URL relative, so the production build runs
// from file://, any static host, and inside an itch.io game frame with no
// absolute paths and no external assets. viteSingleFile inlines JS+CSS into
// one self-contained index.html, which is what makes file:// work (inline
// module scripts are not subject to the CORS block on file:// fetches).
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 2000,
  },
});
