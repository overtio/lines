// Puts the TeX engine that typesets LaTeX notes as PDFs (src/plugins/tex/typeset.ts) in public/busytex/:
// BusyTeX's pdfLaTeX built to WebAssembly, and TeX Live's basic packages. Run with `bun run tex-assets`.
//
// The files come from texlyre-busytex's release for the installed version: a 520 MB archive, of
// which this keeps about 130 MB. Pass the path of an archive already downloaded to use it instead.
// They're too big for git (public/busytex is ignored); a build includes them when they're there.

import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/busytex");
const { version } = JSON.parse(readFileSync(join(root, "node_modules/texlyre-busytex/package.json"), "utf8"));
const url = `https://github.com/TeXlyre/texlyre-busytex/releases/download/assets-v${version}/busytex-assets.tar.gz`;

/** What pdfLaTeX needs: the engine, the scripts that run it in a worker, and the basic packages. */
const KEEP = new Set([
  "busytex.js",
  "busytex.wasm",
  "busytex_pipeline.js",
  "busytex_worker.js",
  "busytex_biber.js",
  "texlive-basic.js",
  "texlive-basic.data",
]);

/** Reads a tar stream, writing the files in KEEP to `out` as they come. */
async function untar(stream) {
  let buffer = Buffer.alloc(0);
  /** The file being written, and how many of its bytes (and padding) are still to come. */
  let file = null;
  let left = 0;
  let padding = 0;
  let written = 0;
  for await (const chunk of stream) {
    buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
    while (true) {
      if (left > 0) {
        const take = Math.min(left, buffer.length);
        if (take === 0) break;
        if (file && !file.write(buffer.subarray(0, take))) await new Promise((resolve) => file.once("drain", resolve));
        buffer = buffer.subarray(take);
        left -= take;
        if (left > 0) break;
        if (file) await new Promise((resolve) => file.end(resolve));
        file = null;
      }
      if (padding > 0) {
        const take = Math.min(padding, buffer.length);
        buffer = buffer.subarray(take);
        padding -= take;
        if (padding > 0) break;
      }
      if (buffer.length < 512) break;
      const header = buffer.subarray(0, 512);
      buffer = buffer.subarray(512);
      if (header.every((byte) => byte === 0)) continue;
      const text = (from, length) => header.subarray(from, from + length).toString("utf8").replace(/\0.*$/s, "");
      const name = (text(345, 155) ? `${text(345, 155)}/` : "") + text(0, 100);
      const size = parseInt(text(124, 12).trim() || "0", 8);
      const base = name.replace(/^(\.\/)?busytex\//, "");
      left = size;
      padding = (512 - (size % 512)) % 512;
      if (KEEP.has(base) && header[156] !== 53) {
        file = createWriteStream(join(out, base));
        written++;
        console.log(`  ${base} (${(size / 1e6).toFixed(1)} MB)`);
      }
    }
  }
  return written;
}

const archive = process.argv[2];
let source;
if (archive) {
  if (!existsSync(archive)) throw new Error(`No archive at ${archive}`);
  console.log(`Reading ${archive}`);
  source = createReadStream(archive);
} else {
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  source = Readable.fromWeb(response.body);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const gunzip = createGunzip();
const [count] = await Promise.all([untar(gunzip), pipeline(source, gunzip)]);
if (count !== KEEP.size) throw new Error(`Found ${count} of the ${KEEP.size} files in the archive`);
console.log(`Done: public/busytex`);
