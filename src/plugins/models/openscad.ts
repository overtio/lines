import { t } from "../../lib/i18n/index.svelte";
import { Jobs } from "./jobs";

/*
 * OpenSCAD, which makes a model from code: run in a worker (openscad.worker.ts), from the files
 * `bun run openscad-assets` puts in public/openscad. A model shows as 3D, a flat one (`square()`,
 * `circle()`) as a drawing; what goes wrong is said as OpenSCAD says it, with the line.
 */

export interface OpenScadJob {
  /** Where OpenSCAD's files are. */
  base: string;
  source: string;
  format: "off" | "svg" | "binstl";
}

/** The file it made, if it did, and everything it said. */
export interface OpenScadRun {
  file: Uint8Array | null;
  log: string[];
}

export type OpenScadResult = { kind: "model"; off: string; notes: string[] } | { kind: "drawing"; svg: string; notes: string[] };

const base = new URL(`${import.meta.env.BASE_URL}openscad`, location.href).href;

let available: Promise<boolean> | undefined;

/** Whether this build has OpenSCAD's files. */
function openScadAvailable() {
  available ??= fetch(`${base}/openscad.wasm`, { method: "HEAD" })
    .then((response) => response.ok && !/text\/html/.test(response.headers.get("content-type") ?? ""))
    .catch(() => false);
  return available;
}

const jobs = new Jobs<OpenScadJob, OpenScadRun>(() => new Worker(new URL("./openscad.worker.ts", import.meta.url), { type: "module" }), 60_000);

/** A line OpenSCAD said, without its own name for the file: "Parser error: syntax error, line 3". */
const said = (line: string) => line.replace(/ in file \/model\.scad,/g, ",");

/** Its warnings and echoes, to show below the model. */
const notes = (log: string[]) => log.filter((line) => /^(WARNING|ECHO):/.test(line)).map(said);

/** What went wrong: its errors, or else its warnings (a file it couldn't import, say), or else that there's nothing. */
function problem(log: string[]) {
  const errors = log.filter((line) => line.startsWith("ERROR:")).map((line) => said(line.slice("ERROR: ".length)));
  const warnings = log.filter((line) => line.startsWith("WARNING:")).map(said);
  return [...errors, ...(errors.length ? [] : warnings)].join("\n") || t("models.empty");
}

async function run(job: Omit<OpenScadJob, "base">) {
  if (!(await openScadAvailable())) throw new Error(t("models.noOpenScad"));
  return jobs.run({ ...job, base });
}

const decode = (file: Uint8Array) => new TextDecoder().decode(file);

async function make(source: string): Promise<OpenScadResult> {
  const solid = await run({ source, format: "off" });
  if (solid.file) return { kind: "model", off: decode(solid.file), notes: notes(solid.log) };
  if (solid.log.some((line) => line.includes("not a 3D object"))) {
    const flat = await run({ source, format: "svg" });
    if (flat.file) return { kind: "drawing", svg: decode(flat.file), notes: notes(flat.log) };
  }
  throw new Error(problem(solid.log));
}

const made = new Map<string, Promise<OpenScadResult>>();

/** The model OpenSCAD makes from `source`, once for the same code. */
export function openScad(source: string): Promise<OpenScadResult> {
  let result = made.get(source);
  if (!result) {
    result = make(source);
    made.set(source, result);
    // A failure isn't kept: it may have been the network, or the time it took.
    result.catch(() => made.delete(source));
    if (made.size > 50) made.delete(made.keys().next().value!);
  }
  return result;
}

/** What `source` makes as a file to print or cut: an STL, or an SVG for a flat model. */
export async function openScadFile(source: string) {
  const made = await openScad(source);
  if (made.kind === "drawing") return { extension: "svg", type: "image/svg+xml", write: async () => new TextEncoder().encode(made.svg) };
  return {
    extension: "stl",
    type: "model/stl",
    write: async () => {
      const stl = await run({ source, format: "binstl" });
      if (!stl.file) throw new Error(problem(stl.log));
      return new Uint8Array(stl.file);
    },
  };
}

/**
 * A flat model's SVG as lines draws it: in the theme's accent on screen, grey with black lines on
 * paper, and about as big as it is (OpenSCAD's units are millimeters), within reason.
 */
export function drawingSvg(svg: string, paper: boolean): string {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = document.documentElement;
  const width = root.getAttribute("viewBox")?.split(/\s+/).map(Number)[2] ?? 0;
  root.removeAttribute("width");
  root.removeAttribute("height");
  root.querySelector("title")?.remove();
  root.setAttribute("style", `max-width: ${Math.round(Math.min(560, Math.max(160, width * 3.78)))}px`);
  const look = paper
    ? "fill: #e4e4e4; stroke: #1a1a1a"
    : "fill: color-mix(in srgb, var(--accent) 22%, transparent); stroke: var(--accent)";
  for (const path of root.querySelectorAll("path")) {
    for (const name of ["fill", "stroke", "stroke-width"]) path.removeAttribute(name);
    path.setAttribute("style", `${look}; stroke-width: 1.5px; fill-rule: evenodd; vector-effect: non-scaling-stroke`);
  }
  return new XMLSerializer().serializeToString(root);
}
