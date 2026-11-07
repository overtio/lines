// Writes public/third-party-notices.txt: the license of every open source package that ships in
// lines, for the About tab. Run with `bun run notices` after changing dependencies.
//
// JavaScript packages are the production dependencies in package.json and everything they depend
// on, as installed, plus Svelte's runtime and Tailwind's CSS (dev dependencies, but bundled). Rust
// crates come from `cargo metadata` for the native apps.
// Identical license texts are printed once, followed by every package they cover.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

// Third-party notices too: what a package bundles from others (IronCalc's WebAssembly, its Rust crates).
const LICENSE_FILE = /^(licen[cs]e|copying|notice|third[-_]party[-_]notices)([-._].*)?(\.(md|txt))?$/i;

function licenseTexts(dir) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => LICENSE_FILE.test(name))
    .sort()
    .map((name) => readFileSync(join(dir, name), "utf8").replace(/\r\n/g, "\n").trim());
}

/** Groups packages by identical license text, so each text is printed once. */
function section(title, packages) {
  const groups = new Map();
  for (const pkg of packages) {
    const texts = licenseTexts(pkg.dir);
    const text = texts.length ? texts.join("\n\n") : `(No license file included; licensed under ${pkg.license}.)`;
    if (!groups.has(text)) groups.set(text, []);
    groups.get(text).push(pkg);
  }
  const rule = "=".repeat(78);
  let out = `${rule}\n${title}\n${rule}\n`;
  for (const [text, pkgs] of groups) {
    const names = pkgs
      .map((p) => `${p.name} ${p.version} (${p.license})`)
      .sort()
      .join("\n");
    out += `\n${"-".repeat(78)}\n${names}\n${"-".repeat(78)}\n\n${text}\n`;
  }
  return out;
}

// JavaScript

/** Where package `name` is installed, as Node finds it from `from`: the nearest node_modules up from there. */
function installed(name, from) {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dirname(dir) === dir) return null;
  }
}

const readPackage = (dir) => JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
const licenseOf = ({ license, licenses }) =>
  (typeof license === "string" ? license : license?.type) ?? licenses?.map((l) => l.type ?? l).join(" OR ") ?? "see repository";

/**
 * The packages these depend on, and theirs in turn, each version once: optional and peer ones where
 * installed, but not native modules for one system (they can't be in a web page), nor Svelte (below).
 */
function dependencies(names, from) {
  const found = new Map();
  const queue = names.map((name) => [name, from]);
  while (queue.length) {
    const [name, parent] = queue.shift();
    // Type definitions don't ship.
    const dir = name === "svelte" || name.startsWith("@types/") ? null : installed(name, parent);
    if (!dir || found.has(dir)) continue;
    const pkg = readPackage(dir);
    if (pkg.os) continue;
    found.set(dir, { name: pkg.name, version: pkg.version, license: licenseOf(pkg), dir });
    for (const next of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })) queue.push([next, dir]);
  }
  return [...found.values()];
}

const js = dependencies(Object.keys(readPackage(root).dependencies), root);
// Svelte's runtime (with what it imports) is compiled into the app, and Tailwind's CSS into its
// stylesheet, though they're dev dependencies; their compilers aren't.
const svelte = installed("svelte", root);
for (const [name, from] of [["svelte", root], ["esm-env", svelte], ["clsx", svelte], ["tailwindcss", root]]) {
  const dir = installed(name, from);
  if (!dir || js.some((p) => p.dir === dir)) continue;
  const pkg = readPackage(dir);
  js.push({ name: pkg.name, version: pkg.version, license: licenseOf(pkg), dir });
}
js.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

// Rust (native apps only): every crate any app target pulls in.
const TARGETS = [
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
  "aarch64-apple-ios",
  "aarch64-linux-android",
  "x86_64-pc-windows-msvc",
  "x86_64-unknown-linux-gnu",
];
const crates = new Map();
for (const target of TARGETS) {
  try {
    const args = ["metadata", "--format-version", "1", "--locked", "--filter-platform", target];
    const meta = JSON.parse(run("cargo", args, join(root, "src-tauri")));
    const used = new Set(meta.resolve.nodes.map((n) => n.id));
    for (const p of meta.packages) {
      if (!used.has(p.id) || meta.workspace_members.includes(p.id)) continue;
      crates.set(p.id, { name: p.name, version: p.version, license: p.license ?? "see repository", dir: dirname(p.manifest_path) });
    }
  } catch (error) {
    console.warn(`Skipping Rust crates for ${target}:`, error.message.split("\n")[0]);
  }
}
const rust = [...crates.values()].sort((a, b) => a.name.localeCompare(b.name));

const header = `Third-party notices for lines

lines is free software under the GNU Affero General Public License v3.0
(https://github.com/overtio/lines/blob/main/LICENSE). It is built on the open
source packages below; their licenses follow.

Theme colors, all MIT: Solarized (c) Ethan Schoonover; Nord (c) Arctic Ice
Studio & Sven Greb; Dracula (c) Dracula Theme; Catppuccin (c) Catppuccin; Tokyo
Night (c) enkia; Gruvbox (c) Pavel Pertsev; Everforest (c) sainnhe; Ayu (c) Ike
Ku. SF Symbols are Apple's and are drawn by macOS and iOS on your device; they
are not included in lines.

Excalidraw's fonts, served with lines for drawings: Excalifont and Virgil
(c) Excalidraw, Nunito (c) The Nunito Project Authors, Lilita One (c) Juan
Montoreano, Assistant (c) The Assistant Project Authors, Cascadia Code (c)
Microsoft, Liberation Sans (c) Red Hat, all under the SIL Open Font License
1.1; Comic Shanns (c) Shannon Miwa, MIT.

`;

const text =
  header +
  section(`JavaScript packages (${js.length}), used by every version of lines`, js) +
  (rust.length ? "\n" + section(`Rust crates (${rust.length}), used by the Mac, Windows, Linux, iPhone and Android apps`, rust) : "");
writeFileSync(join(root, "public/third-party-notices.txt"), text);
console.log(`Wrote public/third-party-notices.txt: ${js.length} JavaScript packages, ${rust.length} Rust crates, ${(text.length / 1024).toFixed(0)} KB`);
