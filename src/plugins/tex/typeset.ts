import type { BusyTexRunner } from "texlyre-busytex";
import type { TypesetProgress, TypesetResult } from "../../lib/plugins/types";
import { ATTACHMENT_PATH, getAttachment, referencedAttachments } from "../../lib/notes/attachments";
import { latexDocument } from "../latex/text";

/*
 * Typesets a LaTeX note as a PDF with a real TeX engine: BusyTeX's pdfLaTeX, built to
 * WebAssembly, with TeX Live's basic packages. Its files (about 130 MB) are put in public/busytex
 * by `bun run tex-assets`, or served from VITE_TEX_ASSETS. The first PDF downloads them; the
 * packages are then kept in the browser (IndexedDB), and the engine in its HTTP cache.
 */

/** Where the engine's files are. */
export const texAssets = (import.meta.env.VITE_TEX_ASSETS || `${import.meta.env.BASE_URL}busytex`).replace(/\/+$/, "");

/** An absolute address, as the worker needs (it reads them relative to its own script). */
const absolute = (path: string) => new URL(path, location.href).href;

let available: Promise<boolean> | null = null;

/** Whether this build has the engine's files. */
export function texAvailable(): Promise<boolean> {
  available ??= fetch(`${texAssets}/busytex.js`, { method: "HEAD" })
    .then((response) => response.ok && !/text\/html/.test(response.headers.get("content-type") ?? ""))
    .catch(() => false);
  return available;
}

/** Told how the download goes, while the engine starts. */
let reportDownload: ((percent: number) => void) | null = null;
let runner: Promise<BusyTexRunner> | null = null;

/** The engine, started once in a worker and kept. */
function engine(): Promise<BusyTexRunner> {
  runner ??= (async () => {
    const { BusyTexRunner } = await import("texlyre-busytex");
    const started = new BusyTexRunner({
      busytexBasePath: absolute(texAssets),
      preloadDataPackages: [absolute(`${texAssets}/texlive-basic.js`)],
      onDownloadProgress: ({ percent }) => reportDownload?.(percent),
    });
    await started.initialize(true);
    return started;
  })();
  // A failed start (offline, say) is tried again next time.
  runner.catch(() => (runner = null));
  return runner;
}

/** The first error in a TeX log: its `! …` message, and the `l.12 …` line that says where, if it does. */
function firstError(log: string): { error: string; at: number | null } {
  const lines = log.split("\n");
  const at = lines.findIndex((line) => line.startsWith("!"));
  if (at < 0) return { error: lines.filter((line) => line.trim()).slice(-3).join("\n"), at: null };
  // A long message wraps onto the lines after it, up to a blank line or TeX's context.
  let end = at + 1;
  while (end < Math.min(lines.length, at + 4) && lines[end].trim() && !/^(l\.\d+ |<)/.test(lines[end])) end++;
  const where = lines.slice(at + 1, at + 12).find((line) => /^l\.\d+ /.test(line));
  return { error: [...lines.slice(at, end), ...(where ? [where] : [])].join("\n"), at: where ? Number(/\d+/.exec(where)![0]) : null };
}

/**
 * The document with Latin Modern as its font, and the line it adds (0 for none). The basic packages
 * have no Type 1 Computer Modern for TS1 and T1 (cm-super), so a bullet or `\usepackage[T1]{fontenc}`
 * would stop pdfLaTeX; Latin Modern has them and looks the same. A font package loaded later still wins.
 */
function withFonts(document: string): { input: string; added: number } {
  if (/\\usepackage(?:\[[^\]]*\])?\{[^}]*\blmodern\b/.test(document)) return { input: document, added: 0 };
  const begin = /^[ \t]*\\documentclass(?:\[[^\]]*\])?\{[^}]*\}.*$/m.exec(document);
  if (!begin) return { input: document, added: 0 };
  const after = begin.index + begin[0].length;
  return { input: `${document.slice(0, after)}\n\\usepackage{lmodern}${document.slice(after)}`, added: document.slice(0, after).split("\n").length + 1 };
}

/** The note's own line for a line of the document made from it (latexDocument wraps a note in one). */
function noteLine(source: string, document: string, line: number): number | null {
  const body = source.trim();
  const leading = source.slice(0, source.indexOf(body)).split("\n").length;
  const start = document.slice(0, document.indexOf(body)).split("\n").length;
  const n = line - start + leading;
  return n >= 1 && n <= source.split("\n").length ? n : null;
}

/**
 * booktabs isn't among the basic packages, and papers use it for their tables. This stands in for
 * it, drawing its rules as plain ones, so they still typeset.
 */
const BOOKTABS = String.raw`\NeedsTeXFormat{LaTeX2e}
\ProvidesPackage{booktabs}[2026/10/29 lines' stand-in: plain rules]
\def\toprule{\hline}
\def\midrule{\hline}
\def\bottomrule{\hline}
\def\specialrule#1#2#3{\hline}
\def\lines@skipopt[#1]{}
\def\addlinespace{\@ifnextchar[\lines@skipopt\relax}
\def\cmidrule{\@ifnextchar[{\lines@cmidrule}{\lines@cmidrule[]}}
\def\lines@cmidrule[#1]{\@ifnextchar({\lines@cmidrulex}{\lines@cmidrulex()}}
\def\lines@cmidrulex(#1)#2{\cline{#2}}
`;

/** Compiles run one at a time: the engine has one file system. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * The note as a PDF, made from the same document Export writes (latexDocument), with the images it
 * includes. Runs pdfLaTeX until references settle, and BibTeX when the note has a \bibliography.
 */
export function typesetTex(body: string, onProgress?: (progress: TypesetProgress) => void): Promise<TypesetResult> {
  const run = queue.then(async (): Promise<TypesetResult> => {
    const additionalFiles: { path: string; content: string | Uint8Array }[] = [];
    if (/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bbooktabs\b/.test(body)) additionalFiles.push({ path: "booktabs.sty", content: BOOKTABS });
    for (const name of referencedAttachments([body])) {
      const data = await getAttachment(name);
      if (data) additionalFiles.push({ path: `attachments/${name}`, content: new Uint8Array(await data.arrayBuffer()) });
    }
    const source = body.replaceAll(`{${ATTACHMENT_PATH}`, "{attachments/");
    const document = latexDocument(source);
    const { input, added } = withFonts(document);
    reportDownload = (percent) => onProgress?.({ phase: "download", percent });
    let tex: BusyTexRunner;
    try {
      tex = await engine();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reportDownload = null;
      return { ok: false, error: message, log: message, line: null, starting: true };
    }
    try {
      onProgress?.({ phase: "compile" });
      const { PdfLatex } = await import("texlyre-busytex");
      const result = await new PdfLatex(tex).compile({
        input,
        additionalFiles,
        rerun: true,
        bibtex: /\\bibliography\{/.test(body),
      });
      if (result.success && result.pdf?.length) return { ok: true, pdf: result.pdf };
      const log = result.logs?.map((entry) => entry.log).find((text) => /^!/m.test(text)) ?? result.log ?? "";
      const { error, at } = firstError(log);
      const line = at === null ? null : noteLine(source, document, added && at > added ? at - 1 : at);
      return { ok: false, error, log, line };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message, log: message, line: null };
    } finally {
      reportDownload = null;
    }
  });
  queue = run.catch(() => {});
  return run;
}
