import type { OpenScadJob, OpenScadRun } from "./openscad";

/*
 * Runs OpenSCAD on a model's code, off the page, as a model can take a while: the OpenSCAD
 * project's own WebAssembly build, from public/openscad (`bun run openscad-assets`). OpenSCAD
 * expects to run once, so each run is a fresh instance of it, which takes a few milliseconds once
 * its code has loaded.
 */

interface Instance {
  callMain(args: string[]): number;
  FS: { writeFile(path: string, data: string): void; readFile(path: string): Uint8Array };
}

type Start = (options: object) => Promise<Instance>;

let loaded: Promise<{ start: Start; wasm: WebAssembly.Module }> | undefined;

function load(base: string) {
  loaded ??= Promise.all([
    import(/* @vite-ignore */ `${base}/openscad.js`).then((module: { default: Start }) => module.default),
    fetch(`${base}/openscad.wasm`)
      .then((response) => {
        if (!response.ok) throw new Error(`OpenSCAD: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => WebAssembly.compile(bytes)),
  ]).then(([start, wasm]) => ({ start, wasm }));
  // Tried again next time, if it failed (offline, say).
  loaded.catch(() => (loaded = undefined));
  return loaded;
}

self.onmessage = async ({ data: { base, source, format } }: MessageEvent<OpenScadJob>) => {
  try {
    const { start, wasm } = await load(base);
    const log: string[] = [];
    const openscad = await start({
      noInitialRun: true,
      print: (line: string) => log.push(line),
      printErr: (line: string) => log.push(line),
      instantiateWasm: (imports: WebAssembly.Imports, done: (instance: WebAssembly.Instance) => void) => {
        void WebAssembly.instantiate(wasm, imports).then(done);
        return {};
      },
    });
    openscad.FS.writeFile("/model.scad", source);
    const out = `/model.${format === "binstl" ? "stl" : format}`;
    let status: number;
    try {
      status = openscad.callMain(["/model.scad", "-o", out, ...(format === "binstl" ? ["--export-format", "binstl"] : [])]);
    } catch (error) {
      status = 1;
      log.push(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    }
    const file = status === 0 ? openscad.FS.readFile(out) : null;
    self.postMessage({ file, log } satisfies OpenScadRun, { transfer: file ? [file.buffer] : [] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
