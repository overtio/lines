// Writes public/third-party-notices.txt: the license of every open source package that ships in
// lines, for the About tab. Run with `pnpm notices` after changing dependencies.
//
// JavaScript packages come from `pnpm licenses list --prod`, plus Svelte's runtime (a dev
// dependency, but bundled). Rust crates come from `cargo metadata` for the native apps.
// Identical license texts are printed once, followed by every package they cover.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([-._].*)?(\.(md|txt))?$/i;

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
const listed = JSON.parse(run("pnpm", ["licenses", "list", "--prod", "--json"]));
const js = Object.values(listed)
  .flat()
  .map((p) => ({ name: p.name, version: p.versions[0], license: p.license, dir: p.paths[0] }));
// Svelte's runtime is compiled into the app even though Svelte is a dev dependency.
for (const name of ["svelte", "esm-env", "clsx"]) {
  const store = join(root, "node_modules/.pnpm");
  const entry = readdirSync(store).find((d) => d.startsWith(`${name}@`));
  if (!entry) continue;
  const dir = join(store, entry, "node_modules", name);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  js.push({ name, version: pkg.version, license: pkg.license, dir });
}
js.sort((a, b) => a.name.localeCompare(b.name));

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
