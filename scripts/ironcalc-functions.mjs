// Writes src/plugins/ironcalc/functions.ts: the functions IronCalc knows, with what each does and
// its arguments, for suggestions while writing a formula. They come from IronCalc's own spreadsheet
// app (@ironcalc/workbook, MIT OR Apache-2.0), which keeps them in its bundle. Run it after
// updating IronCalc, with that package unpacked:
//
//   npm pack @ironcalc/workbook@<version> && tar -xzf ironcalc-workbook-<version>.tgz
//   node scripts/ironcalc-functions.mjs package/dist/ironcalc.js <version>

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [bundle, version] = process.argv.slice(2);
if (!bundle || !version) {
  console.error("Usage: node scripts/ironcalc-functions.mjs <path to @ironcalc/workbook's dist/ironcalc.js> <its version>");
  process.exit(1);
}

const source = readFileSync(bundle, "utf8");
// The catalog is an object literal of plain data: { abs: { description, args: [[name, type, about]…] }, … }.
const start = source.search(/\babs: \{\s*tier:/);
const open = source.lastIndexOf("{", start);
let depth = 0;
let end = open;
for (; end < source.length; end++) {
  if (source[end] === "{") depth++;
  else if (source[end] === "}" && --depth === 0) break;
}
const catalog = Function(`return ${source.slice(open, end + 1)}`)();

/** A description's first sentence, as IronCalc's app shows in its list. */
const first = (text) => (/^.*?[.!?](\s|$)/.exec(text)?.[0] ?? text).trim();

const lines = Object.entries(catalog)
  .map(([name, { description, args }]) => [name.toUpperCase(), first(description), args.map(([arg, , about]) => [arg, about])])
  .sort(([a], [b]) => a.localeCompare(b))
  .map((entry) => `  ${JSON.stringify(entry)},`);

const out = join(dirname(fileURLToPath(import.meta.url)), "../src/plugins/ironcalc/functions.ts");
writeFileSync(
  out,
  `// The functions IronCalc knows: each one's name, what it does, and its arguments (an optional one's
// name ends in *, and "..." stands for more like the one before). From IronCalc's spreadsheet app,
// @ironcalc/workbook ${version} (MIT OR Apache-2.0). Written by scripts/ironcalc-functions.mjs; don't change by hand.
export const FUNCTIONS: [name: string, about: string, args: [name: string, about: string][]][] = [
${lines.join("\n")}
];
`,
);
console.log(`Wrote ${lines.length} functions to ${out}`);
