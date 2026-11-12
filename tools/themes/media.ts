import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * Pixels from pictures and videos, decoded by ffmpeg, which reads nearly every kind of both (and
 * an animated GIF as a video). A link to a page with a video on it (YouTube, Vimeo…) is fetched
 * with yt-dlp first; a link straight to a picture or video goes to ffmpeg as it is.
 */

/** The longest side frames are read at: enough for their colors, quick to group. */
const SIDE = 96;

const MEDIA = /\.(png|jpe?g|webp|gif|avif|bmp|tiff?|mp4|m4v|mov|webm|mkv|avi)(\?|$)/i;

async function run(command: string[]): Promise<Uint8Array> {
  let process;
  try {
    process = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  } catch {
    throw new Error(`${command[0]} isn't installed: it's needed to read ${command[0] === "yt-dlp" ? "links to videos" : "pictures and videos"}`);
  }
  const [out, err, code] = await Promise.all([new Response(process.stdout).bytes(), new Response(process.stderr).text(), process.exited]);
  if (code !== 0) throw new Error(`${command[0]} failed: ${err.trim().split("\n").at(-1)}`);
  return out;
}

/** How long a video is in seconds; 0 for a still picture. */
async function duration(input: string) {
  const out = new TextDecoder().decode(await run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input]));
  const seconds = parseFloat(out);
  return Number.isFinite(seconds) && seconds >= 1 ? seconds : 0;
}

/** A picture's pixels, or `frames` frames' spread evenly through a video, as RGBA bytes. */
async function decode(input: string, frames: number) {
  const seconds = await duration(input);
  const scale = `scale=${SIDE}:${SIDE}:force_original_aspect_ratio=decrease`;
  const filter = seconds ? `fps=${frames / seconds},${scale}` : scale;
  return run(["ffmpeg", "-v", "error", "-i", input, "-vf", filter, ...(seconds ? [] : ["-frames:v", "1"]), "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
}

export interface Media {
  /** RGBA bytes of every frame read. */
  pixels: Uint8Array;
  /** The video's title, for a link yt-dlp fetched. */
  title?: string;
}

/** The pixels of a file or link: a still picture's, or `frames` frames of a video's. */
export async function read(input: string, frames: number): Promise<Media> {
  if (!/^https?:\/\//i.test(input) || MEDIA.test(input)) return { pixels: await decode(input, frames) };
  const folder = await mkdtemp(join(tmpdir(), "swatch-"));
  try {
    // The smallest video stream does: its colors are all that's read.
    const out = await run(["yt-dlp", "--quiet", "--no-playlist", "-f", "wv*[height>=240]/wv*/w", "-o", join(folder, "video.%(ext)s"), "--print", "title", "--print", "after_move:filepath", "--no-simulate", input]);
    const [title, file] = new TextDecoder().decode(out).trim().split("\n");
    return { pixels: await decode(file, frames), title };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
