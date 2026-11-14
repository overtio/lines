import { readFileSync, writeFileSync } from "node:fs";

/*
 * A PDF of a book's text, to read in the tests and to time the reader with: pages of Times set as
 * a book is, its chapters in the PDF's outline (its table of contents), and its title and author in
 * both of the places PDFs keep them, the Info dictionary and XMP. Standard fonts only, so it's
 * small; real text, so it can be selected and searched.
 *
 *   bun tests/browser/books/makePdf.ts pg1342.txt 2 > pride-and-prejudice.pdf
 *
 * makes the fixture from Project Gutenberg's plain text of Pride and Prejudice (public domain),
 * its first two chapters.
 */

export interface Book {
  title: string;
  author: string;
  chapters: { title: string; paragraphs: string[] }[];
}

const PAGE = { width: 432, height: 648, margin: 54 };
const SIZE = 11;
const LEADING = 15;
/** About how many letters of Times fit across the page at SIZE. */
const COLUMNS = Math.floor((PAGE.width - 2 * PAGE.margin) / (SIZE * 0.44));

/** Text in a PDF string, in WinAnsiEncoding: curly quotes and dashes as Windows-1252 has them. */
function pdfString(text: string) {
  const WIN: Record<string, number> = { "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97, "…": 0x85 };
  let out = "";
  for (const char of text) {
    const code = WIN[char] ?? char.codePointAt(0)!;
    if (char === "(" || char === ")" || char === "\\") out += `\\${char}`;
    else if (code < 0x20 || code > 0x7e) out += code <= 0xff ? `\\${code.toString(8).padStart(3, "0")}` : "?";
    else out += char;
  }
  return `(${out})`;
}

/** UTF-16 for the outline's titles and the Info dictionary, which may have any letter. */
const textString = (text: string) => `<FEFF${Array.from(text, (char) => char.charCodeAt(0).toString(16).padStart(4, "0")).join("")}>`;

function wrap(paragraph: string) {
  const lines: string[] = [];
  let line = "";
  for (const word of paragraph.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > COLUMNS) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

export function makePdf(book: Book): Uint8Array {
  // Each page's drawing, and the page each chapter starts on.
  const pages: string[] = [];
  const starts: number[] = [];
  let ops: string[] = [];
  let y = 0;
  const newPage = () => {
    if (ops.length) pages.push(ops.join("\n"));
    ops = [];
    y = PAGE.height - PAGE.margin;
  };
  const show = (text: string, font: string, size: number) => {
    if (y < PAGE.margin + LEADING) newPage();
    ops.push(`BT ${font} ${size} Tf ${PAGE.margin} ${y} Td ${pdfString(text)} Tj ET`);
    y -= size === SIZE ? LEADING : size * 1.6;
  };
  newPage();
  for (const chapter of book.chapters) {
    if (ops.length) newPage();
    starts.push(pages.length);
    y -= LEADING * 2;
    show(chapter.title, "/F2", 16);
    y -= LEADING;
    for (const paragraph of chapter.paragraphs) {
      for (const line of wrap(paragraph)) show(line, "/F1", SIZE);
      y -= LEADING / 2;
    }
  }
  newPage();

  // Objects: 1 catalog, 2 pages, 3 and 4 fonts, 5 info, 6 XMP, 7 outlines, then each chapter's
  // outline item, then each page and its content.
  const objects: string[] = [];
  const firstItem = 8;
  const firstPage = firstItem + book.chapters.length;
  const pageRef = (index: number) => `${firstPage + index * 2} 0 R`;
  const now = "D:20261113000000Z";
  const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${book.title}</rdf:li></rdf:Alt></dc:title><dc:creator><rdf:Seq><rdf:li>${book.author}</rdf:li></rdf:Seq></dc:creator><dc:language><rdf:Bag><rdf:li>en</rdf:li></rdf:Bag></dc:language></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="r"?>`;
  objects[1] = `<< /Type /Catalog /Pages 2 0 R /Metadata 6 0 R /Outlines 7 0 R /PageMode /UseOutlines /Lang (en) >>`;
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => pageRef(index)).join(" ")}] >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>`;
  objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>`;
  objects[5] = `<< /Title ${textString(book.title)} /Author ${textString(book.author)} /Producer (lines tests) /CreationDate (${now}) >>`;
  objects[6] = `<< /Type /Metadata /Subtype /XML /Length ${xmp.length} >>\nstream\n${xmp}\nendstream`;
  const items = book.chapters.length;
  objects[7] = `<< /Type /Outlines /First ${firstItem} 0 R /Last ${firstItem + items - 1} 0 R /Count ${items} >>`;
  book.chapters.forEach((chapter, index) => {
    const links = [index > 0 && `/Prev ${firstItem + index - 1} 0 R`, index < items - 1 && `/Next ${firstItem + index + 1} 0 R`].filter(Boolean).join(" ");
    objects[firstItem + index] = `<< /Title ${textString(chapter.title)} /Parent 7 0 R ${links} /Dest [${pageRef(starts[index])} /XYZ null null null] >>`;
  });
  pages.forEach((content, index) => {
    const at = firstPage + index * 2;
    objects[at] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${at + 1} 0 R >>`;
    objects[at + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  return pdfFile(objects, "/Info 5 0 R");
}

/** A PDF of these objects, numbered from 1 (the catalog), with its cross-reference table. */
function pdfFile(objects: string[], trailer = "") {
  let out = "%PDF-1.7\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R ${trailer} >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character above is one byte (latin1).
  return Uint8Array.from(out, (char) => char.charCodeAt(0));
}

/**
 * A page of Chinese text in a font the PDF names but doesn't carry (STSong, one of Adobe's
 * standard CJK fonts), its characters by Unicode through Adobe's UniGB-UCS2-H character map: what
 * a reader can only read with the map, which pdf.js fetches.
 */
export function cjkPdf(text: string) {
  const hex = Array.from(text, (char) => char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
  const content = `BT /F1 24 Tf 40 100 Td <${hex}> Tj ET`;
  return pdfFile([
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [6 0 R] >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /FontDescriptor 7 0 R >>",
    "<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 93 >>",
  ]);
}

/** Project Gutenberg's plain text of a book, as chapters: its pictures' captions and emphasis marks left out. */
export function gutenbergChapters(text: string, count = Infinity) {
  const body = text.slice(text.indexOf("*** START OF"), text.indexOf("*** END OF"));
  const parts = body.split(/^(?:\[Illustration:[^\]]*?)?(Chapter [IVXLC]+\.)\]?\s*$|^(CHAPTER [IVXLC]+\.)\s*$/m);
  const chapters: Book["chapters"] = [];
  for (let at = 1; at < parts.length && chapters.length < count; at += 3) {
    const title = (parts[at] ?? parts[at + 1]).replace(/^CHAPTER/, "Chapter");
    const paragraphs = parts[at + 2]
      .replace(/\[Illustration(?::[\s\S]*?)?\]\]?/g, "")
      .replace(/_/g, "")
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    chapters.push({ title, paragraphs });
  }
  return chapters;
}

if (import.meta.main) {
  const [path, count] = process.argv.slice(2);
  const chapters = gutenbergChapters(readFileSync(path, "utf8"), Number(count) || Infinity);
  writeFileSync(1, makePdf({ title: "Pride and Prejudice", author: "Jane Austen", chapters }));
}
