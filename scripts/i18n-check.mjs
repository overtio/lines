// Lists the messages each language hasn't translated yet, by file, against English
// (src/lib/i18n/locales/en). Run with `pnpm i18n`. A message a language lacks shows in English;
// keys English doesn't have are type errors, which `pnpm check` finds.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "i18n", "locales");
const KEY = /^\s*"([\w.-]+)":/gm;

const keysIn = (file) => (existsSync(file) ? [...readFileSync(file, "utf8").matchAll(KEY)].map((m) => m[1]) : []);
const areas = readdirSync(join(LOCALES, "en")).filter((file) => file !== "index.ts");
const total = areas.reduce((sum, area) => sum + keysIn(join(LOCALES, "en", area)).length, 0);

let missingAny = false;
for (const locale of readdirSync(LOCALES).filter((name) => name !== "en")) {
  const missing = [];
  for (const area of areas) {
    const have = new Set(keysIn(join(LOCALES, locale, area)));
    const lacking = keysIn(join(LOCALES, "en", area)).filter((key) => !have.has(key));
    if (lacking.length) missing.push(`  ${area}: ${lacking.join(", ")}`);
  }
  const count = missing.reduce((sum, line) => sum + line.split(", ").length, 0);
  console.log(`${locale}: ${missing.length ? `${count} of ${total} messages missing` : `all ${total} messages translated`}`);
  if (missing.length) console.log(missing.join("\n"));
  missingAny ||= missing.length > 0;
}
process.exitCode = missingAny && process.argv.includes("--strict") ? 1 : 0;
