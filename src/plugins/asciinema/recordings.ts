import type { EmbedLink } from "../../lib/plugins/types";

/*
 * Terminal recordings on asciinema.org, by the addresses it gives them: the page,
 * asciinema.org/a/<id>; the preview its embed code shows, /a/<id>.svg; the recording itself,
 * /a/<id>.cast. A recording is asciicast: a line of JSON about the terminal, then a line for each
 * thing it printed, and when.
 */

const ASCIINEMA = /^https?:\/\/(?:www\.)?asciinema\.org\/a\/([a-z0-9]+)(?:\.(svg|png|cast|json))?\/?(?:[?#]\S*)?$/i;

/** The recording an asciinema.org address is for, and which of its addresses it is ("" for its page). */
function onAsciinema(href: string) {
  const match = ASCIINEMA.exec(href);
  return match ? { id: match[1], kind: match[2]?.toLowerCase() ?? "" } : null;
}

/** Where a recording is, and where in it to start and how fast, as its page's address can say (`?t=1:23&speed=2`). */
export interface RecordingSource {
  url: string;
  startAt?: string;
  speed?: number;
}

/** The recording on asciinema.org a link shows: its embed code, or its preview alone; null for anything else. */
export function recordingSource({ href, image }: EmbedLink): RecordingSource | null {
  const shown = image ? onAsciinema(image) : null;
  if (shown?.kind !== "svg" && shown?.kind !== "png") return null;
  const page = href ? onAsciinema(href) : null;
  const options = page?.id === shown.id && !page.kind ? new URL(href!).searchParams : null;
  const speed = Number(options?.get("speed"));
  return { url: `https://asciinema.org/a/${shown.id}.cast`, startAt: options?.get("t") || undefined, speed: speed > 0 ? speed : undefined };
}

/** asciinema's embed code for any address of a recording on asciinema.org, as its page gives it: the preview, linked to the recording. */
export function embedCode(href: string): string | null {
  const recording = onAsciinema(href);
  if (!recording) return null;
  const page = recording.kind ? `https://asciinema.org/a/${recording.id}` : href;
  return `[![asciicast](https://asciinema.org/a/${recording.id}.svg)](${page})`;
}

/**
 * A recording's terminal width, and the time halfway through it, which asciinema.org shows before it
 * plays. Pauses count as no longer than its idle time limit, as the player plays them. Null for
 * what isn't asciicast (version 2 or 3).
 */
export function castInfo(cast: string): { cols: number | null; middle: number } | null {
  const lines = cast.split("\n");
  let header: { version?: number; width?: number; term?: { cols?: number }; idle_time_limit?: number };
  try {
    header = JSON.parse(lines[0]);
  } catch {
    return null;
  }
  // Version 3 times each line from the one before it, version 2 from the start.
  const relative = header.version === 3;
  if (!relative && header.version !== 2) return null;
  const limit = header.idle_time_limit ?? Infinity;
  let last = 0;
  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const time = Number(/^\[\s*([\d.eE+-]+)/.exec(lines[i])?.[1]);
    if (Number.isNaN(time)) continue;
    total += Math.min(relative ? time : time - last, limit);
    last = time;
  }
  return { cols: (relative ? header.term?.cols : header.width) || null, middle: total / 2 };
}
