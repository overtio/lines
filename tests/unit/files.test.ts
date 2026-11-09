import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { diffLines } from "../../src/plugins/changes/diff";
import { isPageBreak, LATEX_PAGE_BREAK, PAGE_BREAK } from "../../src/lib/notes/pageBreak";
import { readPack } from "../../src/lib/sounds/mechvibes";
import { V1_KEYS } from "../../src/lib/sounds/v1keys";
import { unzip, zip } from "../../src/lib/zip";

const bytes = (text: string) => new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
const text = (data: Uint8Array | undefined) => new TextDecoder().decode(data);

/** A ZIP as other apps write them: its files deflated, a folder entry, and sizes after the data (bit 3). */
function otherZip(entries: { name: string; data?: string }[]) {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = bytes(name);
    const packed = data === undefined ? new Uint8Array() : deflateRawSync(bytes(data));
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(6, 0x0808, true);
    local.setUint16(8, data === undefined ? 0 : 8, true);
    local.setUint16(26, nameBytes.length, true);
    const descriptor = new DataView(new ArrayBuffer(16));
    descriptor.setUint32(0, 0x08074b50, true);
    descriptor.setUint32(8, packed.length, true);
    descriptor.setUint32(12, data?.length ?? 0, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, packed, new Uint8Array(descriptor.buffer));
    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true);
    record.setUint16(10, data === undefined ? 0 : 8, true);
    record.setUint32(20, packed.length, true);
    record.setUint32(24, data?.length ?? 0, true);
    record.setUint16(28, nameBytes.length, true);
    record.setUint32(42, offset, true);
    central.push(new Uint8Array(record.buffer), nameBytes);
    offset += 30 + nameBytes.length + packed.length + 16;
  }
  const size = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Uint8Array(Buffer.concat([...parts, ...central, new Uint8Array(end.buffer)])) as Uint8Array<ArrayBuffer>;
}

describe("zip", () => {
  test("what lines writes, it reads back", async () => {
    const modified = new Date(2026, 10, 9, 12, 30);
    const files = await unzip(zip([{ name: "notes/Ünïcode.md", data: "# Hi", modified }, { name: "a.bin", data: new Uint8Array([0, 255, 7]), modified }]));
    expect(text(files.get("notes/Ünïcode.md"))).toBe("# Hi");
    expect([...files.get("a.bin")!]).toEqual([0, 255, 7]);
  });

  test("reads other apps' ZIPs: deflated, with folders and sizes after the data", async () => {
    const files = await unzip(otherZip([{ name: "pack/" }, { name: "pack/config.json", data: '{"name":"X"}' }, { name: "pack/a.txt", data: "a".repeat(5000) }]));
    expect([...files.keys()]).toEqual(["pack/config.json", "pack/a.txt"]);
    expect(text(files.get("pack/config.json"))).toBe('{"name":"X"}');
    expect(files.get("pack/a.txt")!.length).toBe(5000);
  });

  test("says when a file isn't a ZIP", async () => {
    expect(unzip(bytes("hello, not a zip"))).rejects.toThrow();
  });
});

describe("Mechvibes sound packs", () => {
  const pack = (config: object, files: Record<string, string> = {}, folder = "") =>
    new Map([[`${folder}config.json`, bytes(JSON.stringify(config))], ...Object.entries(files).map(([name, data]) => [folder + name, bytes(data)] as const)]);

  test("V1, one file: each key a [start, length] of it; a leading zero is the key let go", () => {
    const read = readPack(pack({ name: "Cream", sound: "sound.ogg", defines: { "30": [100, 50], "030": [200, 40], "57": [300, 60], "9999": [1, 1] } }, { "sound.ogg": "OggS" }), "fallback");
    expect(read.name).toBe("Cream");
    expect(read.keys.KeyA).toEqual({ press: { file: "sound.ogg", start: 100, end: 150 }, release: { file: "sound.ogg", start: 200, end: 240 } });
    expect(read.keys.Space.press).toEqual({ file: "sound.ogg", start: 300, end: 360 });
    expect(Object.keys(read.keys)).toHaveLength(2);
    expect(read.files["sound.ogg"].type).toBe("audio/ogg");
  });

  test("V1, a file for each key", () => {
    const read = readPack(pack({ key_define_type: "multi", defines: { "30": "a.wav", "31": "missing.wav", "32": null } }, { "a.wav": "RIFF" }), "Mine");
    expect(read.name).toBe("Mine");
    expect(read.keys).toEqual({ KeyA: { press: { file: "a.wav" } } });
  });

  test("V2: by key name, pressed and let go, in the pack's file or each key's own", () => {
    const single = readPack(pack({ audio_file: "all.mp3", definitions: { KeyA: { timing: [[0, 80], [90, 150]] }, KeyB: { timing: [[0, 1], [2, 3], [4, 5]] }, KeyC: { timing: [] } } }, { "all.mp3": "ID3" }), "x");
    expect(single.keys).toEqual({ KeyA: { press: { file: "all.mp3", start: 0, end: 80 }, release: { file: "all.mp3", start: 90, end: 150 } } });
    const multi = readPack(pack({ definition_method: "multi", definitions: { KeyA: { audio_file: "a.flac" }, KeyB: { audio_file: "b.flac", timing: [[0, 40]] } } }, { "a.flac": "fLaC", "b.flac": "fLaC" }), "x");
    expect(multi.keys.KeyA).toEqual({ press: { file: "a.flac" } });
    expect(multi.keys.KeyB.press).toEqual({ file: "b.flac", start: 0, end: 40 });
  });

  test("finds the config.json nearest the top, not macOS's copies, and its sounds beside it", () => {
    const files = new Map([
      ["__MACOSX/config.json", bytes("not json")],
      ...pack({ name: "Deep", sound: "./Sound.OGG", defines: { "30": [0, 10] } }, { "sound.ogg": "OggS" }, "My Pack/"),
      ...pack({ name: "Deeper" }, {}, "My Pack/old/"),
    ]);
    const read = readPack(files, "x");
    expect(read.name).toBe("Deep");
    expect(Object.keys(read.files)).toEqual(["./Sound.OGG"]);
  });

  test("says what's wrong with one that isn't a pack", () => {
    expect(() => readPack(new Map([["readme.txt", bytes("hi")]]), "x")).toThrow();
    expect(() => readPack(pack({ sound: "gone.ogg", defines: { "30": [0, 10] } }), "x")).toThrow();
  });

  test("V1's key numbers are browsers' key names", () => {
    expect([V1_KEYS[1], V1_KEYS[28], V1_KEYS[30], V1_KEYS[57]]).toEqual(["Escape", "Enter", "KeyA", "Space"]);
    expect(new Set(Object.values(V1_KEYS)).has("undefined")).toBe(false);
  });
});

describe("line diff", () => {
  const lines = (text: string) => text.split("\n");

  test("nothing changed is no hunks", () => {
    expect(diffLines(lines("a\nb"), lines("a\nb"))).toEqual([]);
  });

  test("a line added, changed and taken out", () => {
    expect(diffLines(lines("a\nb\nc"), lines("a\nx\nb\nc"))).toEqual([{ before: [1, 1], after: [1, 2] }]);
    expect(diffLines(lines("a\nb\nc"), lines("a\nB\nc"))).toEqual([{ before: [1, 2], after: [1, 2] }]);
    expect(diffLines(lines("a\nb\nc"), lines("a\nc"))).toEqual([{ before: [1, 2], after: [1, 1] }]);
  });

  test("changes in two places are two hunks", () => {
    expect(diffLines(lines("a\nb\nc\nd\ne"), lines("A\nb\nc\nd\nE"))).toEqual([
      { before: [0, 1], after: [0, 1] },
      { before: [4, 5], after: [4, 5] },
    ]);
  });

  test("past its limit, everything between is one change", () => {
    const a = Array.from({ length: 100 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 100 }, (_, i) => `b${i}`);
    expect(diffLines(a, b, 10)).toEqual([{ before: [0, 100], after: [0, 100] }]);
  });
});

describe("page breaks", () => {
  test("lines' own, and the div other apps' PDF exports break at", () => {
    for (const line of [PAGE_BREAK, "<!--pagebreak-->", "  <!-- page-break -->  ", '<div style="page-break-after: always"></div>', "<div style='break-before: page;'></div>"]) expect(isPageBreak(line), line).toBe(true);
  });
  test("not a comment that says something else, or text around one", () => {
    for (const line of ["<!-- mark -->", "Text <!-- pagebreak -->", '<div style="color: red"></div>', "pagebreak"]) expect(isPageBreak(line), line).toBe(false);
  });
  test("LaTeX's on a line of their own", () => {
    for (const line of ["\\newpage", "  \\clearpage", "\\cleardoublepage", "\\pagebreak"]) expect(LATEX_PAGE_BREAK.test(line), line).toBe(true);
    expect(LATEX_PAGE_BREAK.test("Text \\newpage")).toBe(false);
  });
});
