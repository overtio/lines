import { deflateSync } from "node:zlib";
import type { Page, Route } from "playwright";
import { zip } from "../../src/lib/zip";

/*
 * Files for the browser tests to give the app, made here rather than kept: a picture, a sound, and a
 * Mechvibes sound pack; and answering the app's requests for them, so nothing's fetched from the web.
 */

/**
 * Answers a request for `body` as a site that lets web pages have it would: the part asked for, if
 * it asks for one (as audio does, to seek).
 */
export function answerFile(route: Route, body: Buffer, contentType: string) {
  const headers = { "access-control-allow-origin": "*", "accept-ranges": "bytes" };
  const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? "");
  if (!range) return route.fulfill({ body, contentType, headers });
  const start = Number(range[1]);
  const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
  return route.fulfill({ status: 206, body: body.subarray(start, end + 1), contentType, headers: { ...headers, "content-range": `bytes ${start}-${end}/${body.length}` } });
}

/** Answers every request for a picture on the web (a feed's artwork, a cover) with a small square. */
export function answerPictures(page: Page) {
  const square = png(8, 8, () => [96, 132, 168]);
  return page.route((url) => url.hostname !== "127.0.0.1" && /\.(?:png|jpe?g|gif|webp)$/i.test(url.pathname), (route) => answerFile(route, square, "image/png"));
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data: Uint8Array) => (data.reduce((crc, byte) => CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;

/** A PNG `width` × `height`, each pixel the color `at(x, y)` gives, as [r, g, b]. */
export function png(width: number, height: number, at: (x: number, y: number) => [number, number, number]) {
  const chunk = (type: string, data: Uint8Array) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "latin1");
    out.set(data, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rows.set(at(x, y), y * (1 + width * 3) + 1 + x * 3);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", new Uint8Array())]);
}

/** A short click, as a WAV file: 16-bit mono at 22,050 Hz. */
export function wav(ms = 60) {
  const rate = 22_050;
  const samples = Math.round((rate * ms) / 1000);
  const out = Buffer.alloc(44 + samples * 2);
  out.write("RIFF", 0, "latin1");
  out.writeUInt32LE(36 + samples * 2, 4);
  out.write("WAVEfmt ", 8, "latin1");
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36, "latin1");
  out.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) out.writeInt16LE(Math.round(Math.sin(i / 3) * 12000 * (1 - i / samples)), 44 + i * 2);
  return out;
}

/** A Mechvibes pack (V2) called `name`, as a .zip: every key the one click, pressed and let go. */
export function soundPack(name: string) {
  const config = { name, author: "Tests", audio_file: "click.wav", definitions: Object.fromEntries(["KeyA", "KeyS", "Space", "Enter"].map((code) => [code, { timing: [[0, 30], [30, 60]] }])) };
  const modified = new Date(2026, 0, 1);
  return Buffer.from(zip([{ name: `${name}/config.json`, data: JSON.stringify(config), modified }, { name: `${name}/click.wav`, data: wav(), modified }]));
}
