import { parseArgs } from "node:util";
import { pictureName } from "../../src/lib/themes/picture";
import { points, swatches } from "../../src/lib/themes/swatches";
import { run, save } from "./cli";
import { read } from "./media";
import { toFile, writeSwatchFile } from "./swatch-file";

const HELP = `Makes a swatch of the colors in pictures and videos.

  bun run swatch <picture, video or link>… [options]

  -n, --colors <n>    how many colors (16; at least 2)
  -f, --frames <n>    frames read through a video (120)
      --name <name>   the swatch's name (the video's title, or the first file's name)
  -o, --out <folder>  where its files go (.)

Writes <name>.swatch.json (for adapt), <name>.gpl (GIMP, Inkscape, Krita) and <name>.svg.
Needs ffmpeg; links to video pages (YouTube, Vimeo…) need yt-dlp too.`;

run(async () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      colors: { type: "string", short: "n", default: "16" },
      frames: { type: "string", short: "f", default: "120" },
      name: { type: "string" },
      out: { type: "string", short: "o", default: "." },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help || !positionals.length) return console.log(HELP);
  const [count, frames] = [Number(values.colors), Number(values.frames)];
  if (!Number.isInteger(count) || count < 2) throw new Error("--colors takes a whole number, 2 or more");
  if (!Number.isInteger(frames) || frames < 1) throw new Error("--frames takes a whole number, 1 or more");
  const media = await Promise.all(positionals.map((input) => read(input, frames)));
  const pixels = new Uint8Array(media.reduce((sum, { pixels }) => sum + pixels.length, 0));
  media.reduce((at, { pixels: each }) => (pixels.set(each, at), at + each.length), 0);
  const found = swatches(points(pixels), count);
  if (!found.length) throw new Error("There are no colors to read in that");
  const name = values.name ?? media[0].title ?? pictureName(positionals[0].split(/[/\\]/).pop()!);
  console.log(`${name}: ${found.length} colors`);
  await save(values.out, writeSwatchFile(toFile(name, positionals, found)));
});
