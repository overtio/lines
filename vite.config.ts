import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
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

/** Settings' files: a section's each, named for it (`ThemeSection.svelte`), and the parts they're made of. */
const SETTINGS = fileURLToPath(new URL("src/lib/components/settings/", import.meta.url));
/** Plugins' folders, where a plugin's own page of settings is named for it (`MascotsSettings.svelte`). */
const PLUGINS = fileURLToPath(new URL("src/plugins/", import.meta.url));

/**
 * What Settings' search looks through (components/settings/search.ts), as `virtual:settings-search`:
 * the messages each section shows, by its id, read from its file and the files of its parts, so
 * a setting added to one is found without listing it anywhere else; each with the part it's in
 * (`ThemeEditor`), the first for one in several. A plugin's page is `plugin:<its id>`, the id from
 * its file's name (`SfSymbolsSettings.svelte` is `sf-symbols`'s).
 */
function settingsSearch(): Plugin {
  const id = "virtual:settings-search";
  const resolved = `\0${id}`;
  return {
    name: "lines:settings-search",
    resolveId: (source) => (source === id ? resolved : undefined),
    load(module) {
      if (module !== resolved) return;
      const keysOf = (path: string, seen: Set<string>): [key: string, part: string][] => {
        if (seen.has(path)) return [];
        seen.add(path);
        this.addWatchFile(path);
        // Not what's only said or shown once something happens, which search couldn't lead to: said aloud
        // (`speak(t("settings.themeCopied"))`), a message set when something's done or goes wrong
        // (`pictureError = t(…)`), a button's words while it's busy, and a share menu's, shown once it's open.
        const source = readFileSync(path, "utf8").replace(/(speak\(|\b\w+ = t\(|\b(busyLabel|copyLabel|copied|downloadLabel)=\{)[^\n]*/g, "");
        const part = basename(path, ".svelte");
        const keys = [...source.matchAll(/"([a-z][A-Za-z]*\.[A-Za-z0-9_.-]+)"/g)].map((found): [string, string] => [found[1], part]);
        const parts = [...source.matchAll(/from "\.\/([A-Za-z]+\.svelte)"/g)].flatMap((found) => keysOf(join(dirname(path), found[1]), seen));
        return [...keys, ...parts];
      };
      const own = readdirSync(SETTINGS)
        .filter((file) => file.endsWith("Section.svelte"))
        .map((file) => [file.slice(0, -"Section.svelte".length).toLowerCase(), join(SETTINGS, file)]);
      const pluginPages = readdirSync(PLUGINS, { recursive: true, encoding: "utf8" })
        .filter((file) => file.endsWith("Settings.svelte"))
        .map((file) => {
          const name = basename(file, "Settings.svelte");
          return [`plugin:${name.replace(/(?<=.)([A-Z])/g, "-$1").toLowerCase()}`, join(PLUGINS, file)];
        });
      const index = Object.fromEntries(
        [...own, ...pluginPages].map(([section, path]) => {
          const parts: Record<string, string> = {};
          for (const [key, part] of keysOf(path, new Set())) parts[key] ??= part;
          return [section, parts];
        }),
      );
      return `export default ${JSON.stringify(index)};`;
    },
  };
}

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [svelte(), tailwindcss(), reloadOnStateChange(), excalidrawFonts(), settingsSearch()],
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
  // Workers as modules, as in development: OpenSCAD's worker imports OpenSCAD's own module (plugins/models/).
  worker: { format: "es" },
  // IronCalc's WebAssembly loads from its own package (plugins/ironcalc/calc.ts), not pre-bundled.
  // OpenCascade's reader is found only once a STEP file is shown, which would reload the page.
  optimizeDeps: { exclude: ["@ironcalc/wasm-xlsx"], include: ["occt-import-js"] },
  build: {
    target: "es2022",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
