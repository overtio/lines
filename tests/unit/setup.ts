import { plugin } from "bun";
import { compileModule } from "svelte/compiler";

/*
 * What unit tests need to import lines' modules outside a browser: `.svelte.ts` modules (with
 * runes, `$state`) compiled as Vite's Svelte plugin compiles them, `?raw` imports read as text, and
 * stylesheets (fonts a plugin imports) as nothing. Loaded before every unit test (package.json).
 */

const typescript = new Bun.Transpiler({ loader: "ts" });

plugin({
  name: "lines-unit",
  setup(build) {
    build.onLoad({ filter: /\.svelte\.ts$/ }, async ({ path }) => {
      const js = typescript.transformSync(await Bun.file(path).text());
      return { contents: compileModule(js, { filename: path, generate: "client" }).js.code, loader: "js" };
    });
    build.onResolve({ filter: /\?raw$/ }, ({ path, importer }) => ({ path: Bun.resolveSync(path.slice(0, -4), importer.replace(/[^/]+$/, "")), namespace: "raw" }));
    build.onLoad({ filter: /.*/, namespace: "raw" }, async ({ path }) => ({ contents: `export default ${JSON.stringify(await Bun.file(path).text())};`, loader: "js" }));
    build.onLoad({ filter: /\.css$/ }, () => ({ contents: "", loader: "js" }));
  },
});

/** Browsers' storage, kept in memory for the run. */
class MemoryStorage {
  #items = new Map<string, string>();
  getItem = (key: string) => this.#items.get(key) ?? null;
  setItem = (key: string, value: string) => void this.#items.set(key, String(value));
  removeItem = (key: string) => void this.#items.delete(key);
  clear = () => this.#items.clear();
}
globalThis.localStorage ??= new MemoryStorage() as unknown as Storage;

/** The version Vite builds in (vite.config.ts), which the apps' requests say. */
(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "0.0.0";
