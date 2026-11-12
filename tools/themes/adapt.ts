import { basename } from "node:path";
import { parseArgs } from "node:util";
import { readThemeFile, THEME_FILE_EXTENSION, type ThemeFile, writeThemeFile } from "../../src/lib/themes/file";
import { themeFromSwatches } from "../../src/lib/themes/swatches";
import { run, save } from "./cli";
import { readable } from "./colors";
import { readSwatchFile } from "./swatch-file";
import { base24 } from "./targets/base24";
import { slug, type Written } from "./targets/common";
import { gtk } from "./targets/gtk";
import { vscode } from "./targets/vscode";

const TARGETS: Record<string, (theme: ThemeFile) => Written> = {
  lines: (theme) => ({ [`${theme.name}${THEME_FILE_EXTENSION}`]: writeThemeFile(theme) }),
  vscode,
  gtk,
  base24,
};

const HELP = `Makes themes for apps from a swatch or a lines theme.

  bun run adapt-theme <file.swatch.json | file${THEME_FILE_EXTENSION}> [options]

  -t, --to <targets>  which, by commas: ${Object.keys(TARGETS).join(", ")} (all)
      --name <name>   the theme's name (the file's)
  -o, --out <folder>  where they go (a folder named after the theme)

A swatch makes a light and a dark theme, as Settings → Theme → New → From a Picture… does.`;

// What lines' theme files are checked with, outside a browser: colors these tools can read.
globalThis.CSS ??= { supports: (_: string, value?: string) => !!value && readable(value) } as typeof CSS;

run(async () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      to: { type: "string", short: "t", default: Object.keys(TARGETS).join(",") },
      name: { type: "string" },
      out: { type: "string", short: "o" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help || positionals.length !== 1) return console.log(HELP);
  const [input] = positionals;
  const targets = values.to.split(",").map((target) => target.trim().toLowerCase());
  const unknown = targets.filter((target) => !TARGETS[target]);
  if (unknown.length) throw new Error(`No target called ${unknown.join(", ")}: there's ${Object.keys(TARGETS).join(", ")}`);
  const json: unknown = await Bun.file(input).json().catch(() => undefined);
  const swatch = readSwatchFile(json);
  const theme = swatch ? themeFromSwatches(swatch.swatches, swatch.name) : readThemeFile(json);
  if (!theme) throw new Error(`${basename(input)} isn't a swatch or a lines theme file`);
  if (values.name) theme.name = values.name;
  const folder = values.out ?? slug(theme.name);
  console.log(`${theme.name}:`);
  for (const target of targets) await save(`${folder}/${target}`, TARGETS[target](theme));
});
