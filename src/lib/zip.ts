/**
 * A minimal ZIP writer: files are stored uncompressed, which keeps this tiny and is fine for
 * text (and images, which are compressed already). Names are UTF-8, and each file keeps its own modification time.
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, in local time, as ZIP stores them. */
function dosTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export interface ZipEntry {
  name: string;
  /** Text (saved as UTF-8) or a file's bytes. */
  data: string | Uint8Array;
  modified: Date;
}

export function zip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const crc = crc32(data);
    const { time, day } = dosTime(entry.modified);

    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true); // local file header
    header.setUint16(4, 20, true); // version needed
    header.setUint16(6, 0x0800, true); // UTF-8 names
    header.setUint16(8, 0, true); // stored
    header.setUint16(10, time, true);
    header.setUint16(12, day, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, data.length, true);
    header.setUint32(22, data.length, true);
    header.setUint16(26, name.length, true);
    local.push(new Uint8Array(header.buffer), name, data);

    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true); // central directory header
    record.setUint16(4, 20, true); // version made by
    record.setUint16(6, 20, true); // version needed
    record.setUint16(8, 0x0800, true);
    record.setUint16(10, 0, true);
    record.setUint16(12, time, true);
    record.setUint16(14, day, true);
    record.setUint32(16, crc, true);
    record.setUint32(20, data.length, true);
    record.setUint32(24, data.length, true);
    record.setUint16(28, name.length, true);
    record.setUint32(42, offset, true);
    central.push(new Uint8Array(record.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A file in a ZIP: how big it is unpacked, and its bytes, inflated when asked for. */
export interface ZippedFile {
  /** Its size unpacked, as the ZIP says. */
  size: number;
  /** Its bytes; rejects for one bigger than the ZIP says it is, or than the limit. */
  read(): Promise<Uint8Array<ArrayBuffer>>;
}

/** The most a file in a ZIP is unpacked to, by default: many times any picture or chapter in a book. */
const LIMIT = 256 * 1024 * 1024;

/** A file in a ZIP that unpacks to more than it should: a damaged ZIP, or one made to fill memory. */
const tooBig = () => new Error("A file in the ZIP is bigger than it says");

/** Inflates `stored`, stopping as soon as it comes to more than `size` bytes. */
async function inflate(stored: Uint8Array<ArrayBuffer>, size: number): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  const reader = new Blob([stored]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    length += chunk.value.length;
    if (length > size) {
      await reader.cancel();
      throw tooBig();
    }
    chunks.push(chunk.value);
  }
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}

/**
 * The files in a ZIP by name (folders left out), stored or deflated, as nearly every ZIP has them;
 * each inflated by the browser's own DecompressionStream only when it's read, to no more than the
 * size the ZIP gives it, nor `limit`. Not ZIP64, nor encrypted files.
 */
export function zipEntries(data: Uint8Array<ArrayBuffer>, limit = LIMIT): Map<string, ZippedFile> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // The end of the central directory, which a comment of up to 64 KB can follow.
  let end = -1;
  for (let at = data.length - 22; at >= Math.max(0, data.length - 22 - 0xffff); at--) {
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error("Not a ZIP file");
  const names = new TextDecoder();
  const files = new Map<string, ZippedFile>();
  let at = view.getUint32(end + 16, true);
  for (let count = view.getUint16(end + 10, true); count > 0; count--) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error("A damaged ZIP file");
    const method = view.getUint16(at + 10, true);
    const packed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = names.decode(data.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (name.endsWith("/") || (method !== 0 && method !== 8)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const stored = data.subarray(start, start + packed);
    files.set(name, {
      size,
      async read() {
        if (size > limit || (method === 0 && packed !== size)) throw tooBig();
        return method === 0 ? stored : inflate(stored, size);
      },
    });
  }
  return files;
}

/** Every file in a ZIP by name, inflated (zipEntries). */
export async function unzip(data: Uint8Array<ArrayBuffer>): Promise<Map<string, Uint8Array<ArrayBuffer>>> {
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const [name, file] of zipEntries(data)) files.set(name, await file.read());
  return files;
}
