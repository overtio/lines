// Puts OpenSCAD, which draws ```openscad blocks in notes as 3D models (src/plugins/models/), in
// public/openscad/: the OpenSCAD project's own WebAssembly build. Run with `bun run openscad-assets`.
//
// The build is a dated snapshot from files.openscad.org, pinned with its SHA-256 so a changed file
// is refused. Like packages, a snapshot is only taken once it's at least 10 days old. The files
// (about 11 MB) are too big for git (public/openscad is ignored); a build includes them when they're there.

import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const SNAPSHOT = "OpenSCAD-2026.10.27-WebAssembly-web.zip";
const SHA256 = "04bad2bca61bea4e89e02038509430ef8e17ce66503f90e1eb0deb93fe193fbf";
const FILES = ["openscad.js", "openscad.wasm"];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/openscad");
const url = `https://files.openscad.org/snapshots/${SNAPSHOT}`;

/** The files in a zip archive, by name: read from its central directory at the end. */
function unzip(zip) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("Not a zip archive");
  const count = zip.readUInt16LE(end + 10);
  const files = new Map();
  for (let at = zip.readUInt32LE(end + 16), i = 0; i < count; i++) {
    const method = zip.readUInt16LE(at + 10);
    const packedSize = zip.readUInt32LE(at + 20);
    const size = zip.readUInt32LE(at + 24);
    const nameLength = zip.readUInt16LE(at + 28);
    const name = zip.toString("utf8", at + 46, at + 46 + nameLength).replace(/^.*\//, "");
    // The file's data follows its local header, whose name and extra field can differ from the central one's.
    const local = zip.readUInt32LE(at + 42);
    const from = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const packed = zip.subarray(from, from + packedSize);
    const data = method === 8 ? inflateRawSync(packed) : packed;
    if (data.length !== size) throw new Error(`${name} didn't unpack whole`);
    files.set(name, data);
    at += 46 + nameLength + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return files;
}

console.log(`Downloading ${url}`);
const response = await fetch(url);
if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
const zip = Buffer.from(await response.arrayBuffer());
const hash = createHash("sha256").update(zip).digest("hex");
if (hash !== SHA256) throw new Error(`${SNAPSHOT} isn't the file pinned here (its SHA-256 is ${hash})`);

const files = unzip(zip);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const name of FILES) {
  const data = files.get(name);
  if (!data) throw new Error(`${name} isn't in ${SNAPSHOT}`);
  writeFileSync(join(out, name), data);
  console.log(`  ${name} (${(data.length / 1e6).toFixed(1)} MB)`);
}
console.log("Done: public/openscad");
