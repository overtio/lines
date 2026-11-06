import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type EnvironmentModuleNode, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json" with { type: "json" };

const host = process.env.TAURI_DEV_HOST;

/** Modules that hold the app's state: the notes, sync, the lock, settings, open windows. */
const STATEFUL = /\/src\/lib\/(?:.+\.svelte\.ts|notes\/storage\.ts|windows\/floating\.ts)$/;

/**
 * Reloads the page, rather than updating it in place, when a change reaches a module that holds
 * the app's state. Updated in place, it would run again and make a second store (or sync engine…)
 * that never loaded, which the components updated with it would use while the rest of the app
 * kept the first: a Reset in Settings then reset an empty store.
 */
function reloadOnStateChange(): Plugin {
  return {
    name: "lines:reload-on-state-change",
    apply: "serve",
    hotUpdate({ modules }) {
      if (this.environment.name !== "client") return;
      const seen = new Set<EnvironmentModuleNode>();
      const reaches = (mod: EnvironmentModuleNode): boolean => {
        if (seen.has(mod)) return false;
        seen.add(mod);
        return (!!mod.file && STATEFUL.test(mod.file)) || [...mod.importers].some(reaches);
      };
      if (!modules.some(reaches)) return;
      this.environment.hot.send({ type: "full-reload" });
      return [];
    },
  };
}

/** Excalidraw's fonts, which it loads from where drawings.ts says (or else a CDN). */
const EXCALIDRAW_FONTS = fileURLToPath(new URL("node_modules/@excalidraw/excalidraw/dist/prod/fonts", import.meta.url));

/**
 * Serves Excalidraw's fonts with the app, under excalidraw/fonts/, so drawings work offline and in
 * the apps. All but Xiaolai, its Chinese and Japanese hand (12 MB): Excalidraw then fetches that
 * from its CDN, which the apps don't allow, so there that text is in a system font.
 */
function excalidrawFonts(): Plugin {
  const files = () =>
    readdirSync(EXCALIDRAW_FONTS, { recursive: true, encoding: "utf8" })
      .filter((path) => path.endsWith(".woff2") && !path.startsWith("Xiaolai"));
  return {
    name: "lines:excalidraw-fonts",
    configureServer(server) {
      server.middlewares.use("/excalidraw/fonts/", (req, res) => {
        const path = join(EXCALIDRAW_FONTS, decodeURIComponent(req.url!.split("?")[0]));
        if (!path.startsWith(EXCALIDRAW_FONTS + "/") || !statSync(path, { throwIfNoEntry: false })?.isFile() || path.includes("/Xiaolai/")) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader("Content-Type", "font/woff2");
        createReadStream(path).pipe(res);
      });
    },
    generateBundle() {
      for (const path of files()) {
        this.emitFile({ type: "asset", fileName: `excalidraw/fonts/${path}`, source: readFileSync(join(EXCALIDRAW_FONTS, path)) });
      }
    },
  };
}

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [svelte(), tailwindcss(), reloadOnStateChange(), excalidrawFonts()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  // IronCalc's WebAssembly loads from its own package (plugins/ironcalc/calc.ts), not pre-bundled.
  optimizeDeps: { exclude: ["@ironcalc/wasm-xlsx"] },
  build: {
    target: "es2022",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
