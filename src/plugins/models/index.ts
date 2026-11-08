import type { EditorView } from "@codemirror/view";
import { blockName, fenceAt } from "../../lib/editor/rendered";
import { insert, named, SECTIONS } from "../../lib/editor/slashCommands";
import { t } from "../../lib/i18n/index.svelte";
import { fileName } from "../../lib/notes/export";
import { plugins } from "../../lib/plugins/registry.svelte";
import type { FileView, Plugin, Renderer, ViewedFile } from "../../lib/plugins/types";
import { saveAndShow } from "../../lib/save";
import { openScadCode } from "./language";
import { drawingSvg, openScad, openScadFile } from "./openscad";
import type { Model } from "./read";

/*
 * 3D models in notes, to turn around and zoom into: ```openscad blocks, made from their code by
 * OpenSCAD as you type, ```stl blocks (as GitHub draws them), and attached OpenSCAD, STL, OBJ,
 * PLY, OFF, 3MF, glTF, STEP and IGES files. On paper, each prints as a picture. three.js draws them
 * (view.ts), and loads the first time a note has one; OpenSCAD and OpenCascade, which reads CAD
 * files, are larger still and load the first time they're needed.
 */

/** The files it shows, by extension: OpenSCAD's code, and those read.ts reads. */
const FILES = ["scad", "stl", "obj", "ply", "off", "3mf", "glb", "gltf", "step", "stp", "iges", "igs", "brep"];

const made = new Map<string, Promise<Model>>();

/** A model, made once for the same `key` (its code, or its file's name). */
function model(key: string, make: () => Promise<Model>) {
  let found = made.get(key);
  if (!found) {
    found = make();
    made.set(key, found);
    found.catch(() => made.delete(key));
    if (made.size > 20) made.delete(made.keys().next().value!);
  }
  return found;
}

/** A model on screen, to turn around, or on paper, as a picture. */
async function draw(model: Promise<Model>, key: string, paper: boolean, notes?: string[]) {
  const [view, shown] = await Promise.all([import("./view"), model]);
  return paper ? view.modelPicture(shown) : view.modelView(shown, key, notes);
}

/** What OpenSCAD makes of `source`: a model, by `key`, or a flat one's drawing, as SVG markup. */
async function drawOpenScad(source: string, paper: boolean, key = `openscad\n${source}`) {
  const result = await openScad(source);
  if (result.kind === "drawing") return drawingSvg(result.svg, paper);
  return draw(model(`openscad\n${source}`, async () => (await import("./read")).offModel(result.off)), key, paper, result.notes);
}

/** An attached file's model: made by OpenSCAD from a .scad file's code, or read from a 3D file. */
async function drawFile(file: ViewedFile, paper: boolean): Promise<Element> {
  const key = `file\n${file.name}`;
  if (!file.name.endsWith(".scad")) return draw(model(key, async () => (await import("./read")).readModel(file.name, await file.data.arrayBuffer())), key, paper);
  const drawn = await drawOpenScad(await file.data.text(), paper, key);
  if (typeof drawn !== "string") return drawn;
  const drawing = document.createElement("div");
  drawing.className = paper ? "doc-model-drawing" : "cm-lp-model-drawing";
  drawing.innerHTML = drawn;
  return drawing;
}

/** Saves what an ```openscad block makes, named after the block or the note, for a printer or a cutter. */
async function download(view: EditorView, pos: number) {
  const node = fenceAt(view.state, pos);
  const code = node?.getChild("CodeText");
  const info = node?.getChild("CodeInfo");
  if (!code) return;
  const title = (info && blockName(view.state.sliceDoc(info.from, info.to))) || plugins.language().meta(view.state.doc.toString()).title;
  const { extension, type, write } = await openScadFile(view.state.sliceDoc(code.from, code.to));
  await saveAndShow(`${fileName(title || t("models.model"))}.${extension}`, write, type);
}

const openScadBlocks: Renderer = {
  id: "openscad",
  name: "OpenSCAD",
  languages: ["openscad", "scad"],
  label: t("models.model"),
  render: (source, { paper }) => drawOpenScad(source, paper),
  actions: [
    {
      label: t("models.download"),
      icon: "download",
      run: (view, pos) => void download(view, pos).catch((error) => console.error("lines: couldn't make the model's file", error)),
    },
  ],
};

const stlBlocks: Renderer = {
  id: "stl",
  name: "STL",
  languages: ["stl"],
  label: t("models.model"),
  render(source, { paper }) {
    const key = `stl\n${source}`;
    return draw(model(key, async () => (await import("./read")).readModel("model.stl", new TextEncoder().encode(source).buffer)), key, paper);
  },
};

const modelFiles: FileView = {
  id: "models",
  extensions: FILES,
  show(dom, file) {
    let gone = false;
    dom.classList.add("cm-lp-model-slot");
    dom.textContent = t("models.reading");
    drawFile(file, false)
      .catch((error: Error) => Object.assign(document.createElement("span"), { className: "cm-lp-model-message", textContent: error.message }))
      .then((content) => {
        if (gone) return;
        dom.classList.remove("cm-lp-model-slot");
        dom.replaceChildren(content);
      });
    return { destroy: () => void (gone = true) };
  },
  print: (file) => drawFile(file, true),
};

export const models = (): Plugin => ({
  id: "models",
  name: t("plugins.models"),
  description: t("plugins.models.description"),
  icon: "box",
  enabledByDefault: true,
  contributes: {
    renderers: [openScadBlocks, stlBlocks],
    files: [modelFiles],
    codeLanguages: [openScadCode],
    markdown: [
      {
        commands: [
          {
            ...named("editor.slash.model"),
            after: "diagram",
            hint: "openscad",
            icon: "box",
            section: SECTIONS.insert,
            apply: insert("```openscad\ndifference() {\n  cube(20, center = true);\n  sphere(r = 13);\n}|\n```", true),
          },
        ],
      },
    ],
  },
});
