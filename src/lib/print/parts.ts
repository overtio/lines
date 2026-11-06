import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightCode, tagHighlighter, tags } from "@lezer/highlight";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import type { IconName } from "../icons/icons";
import { t } from "../i18n/index.svelte";
import { loadMath, type Macros, NO_MACROS } from "../editor/math";
import { unsplashImage } from "../editor/unsplash";
import { attachmentName, attachmentURL, imageSize } from "../notes/attachments";
import { symbolPieces } from "../notes/symbols";
import type { Cells, FindSheet, MathEngine, Renderer } from "../plugins/types";
import { showFormulas } from "../sheets/formulas";

/*
 * The pieces a printed note is made of that take a moment to draw: math and code blocks drawn by
 * plugins (KaTeX, Mermaid), tables' formulas (IronCalc), highlighted code and images. Each is drawn into an element now and
 * finished later; `ready()` waits for all of them, so pages are measured only once everything has
 * its size.
 */

/** Code's colors on paper, by kind, as the editor groups them (setup.ts). See print.css. */
const highlighter = tagHighlighter([
  { tag: [tags.keyword, tags.modifier, tags.self, tags.operatorKeyword, tags.tagName], class: "doc-k" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character], class: "doc-s" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit, tags.constant(tags.variableName)], class: "doc-n" },
  { tag: [tags.comment, tags.meta], class: "doc-c" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName, tags.attributeName], class: "doc-f" },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.standard(tags.variableName), tags.propertyName], class: "doc-t" },
]);

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children);
  return element;
}

export class Parts {
  #pending: Promise<unknown>[] = [];
  #icons: Record<string, unknown>[] = [];
  #math: MathEngine | null | undefined;
  #mathLoading: Promise<void> | undefined;

  /** Waits for everything still being drawn. */
  async ready() {
    // Drawing one piece can start another (a diagram's fonts), so wait until nothing new is added.
    for (let seen = 0; seen < this.#pending.length; ) {
      const batch = this.#pending.slice(seen);
      seen = this.#pending.length;
      await Promise.allSettled(batch);
    }
    await document.fonts?.ready;
  }

  /** Takes down what was mounted for the document (its icons). */
  destroy() {
    for (const mounted of this.#icons) void unmount(mounted);
    this.#icons = [];
  }

  #later(work: Promise<unknown>) {
    this.#pending.push(work);
  }

  /**
   * What a table's formulas work out to, in their cells' elements (by row, as `cells`); numbers to
   * the right with `numbers`, as in a spreadsheet. `find` finds the other sheets they name, and
   * `show` turns what they work out to into what's printed.
   */
  formulas(cells: Cells, elements: HTMLElement[][], { numbers = false, find, show }: { numbers?: boolean; find?: FindSheet; show?: (text: string) => Node | string } = {}) {
    const classes = { pending: "doc-formula-pending", error: "doc-formula-error", number: numbers ? "doc-number" : undefined };
    this.#later(showFormulas(cells, elements, classes, { find, show }));
  }

  /** Math: within text, or displayed on its own. */
  math(tex: string, display: boolean, macros: Macros = NO_MACROS): HTMLElement {
    const dom = el(display ? "div" : "span", display ? "doc-math is-display" : "doc-math");
    const draw = () => {
      try {
        if (!this.#math) throw new Error();
        this.#math.render(dom, tex, { display, macros: macros.map });
      } catch {
        // As written, the way the editor shows math the engine can't read (or with no engine on).
        dom.textContent = tex;
        dom.classList.add("is-error");
      }
    };
    if (this.#math !== undefined) draw();
    else {
      this.#mathLoading ??= loadMath().then((engine) => void (this.#math = engine));
      this.#later(this.#mathLoading.then(draw));
    }
    return dom;
  }

  /** A code block, highlighted for its language once that has loaded; with `symbols`, `->` shows as → (notes/symbols.ts). */
  code(source: string, language: string, symbols = false): HTMLElement {
    const shown = symbols ? symbolPieces(source) : (from: number, to: number) => source.slice(from, to);
    const code = el("code", "", shown(0, source.length));
    const pre = el("pre", "doc-code", code);
    const found = language ? LanguageDescription.matchLanguageName(languages, language, true) : null;
    if (found) {
      this.#later(
        found.load().then((support) => {
          const parts = document.createDocumentFragment();
          let pos = 0;
          highlightCode(
            source,
            support.language.parser.parse(source),
            highlighter,
            (text, classes) => {
              const piece = shown(pos, (pos += text.length));
              if (piece) parts.append(classes ? el("span", classes, piece) : piece);
            },
            () => {
              parts.append("\n");
              pos++;
            },
          );
          code.replaceChildren(parts);
        }),
      );
    }
    return pre;
  }

  /**
   * A code block drawn by a renderer plugin (a Mermaid diagram), in black and white, at the width
   * its code block gives (```mermaid |400) if it does. Code it can't draw prints as code.
   */
  rendered(renderer: Renderer, source: string, width: number | null = null, note?: string): HTMLElement {
    const dom = el("div", "doc-diagram");
    this.#later(
      renderer
        .render(source, { paper: true, note })
        .then((drawn) => {
          if (typeof drawn === "string") dom.innerHTML = drawn;
          else dom.replaceChildren(drawn);
          // No wider than the page (print.css).
          const svg = dom.querySelector("svg");
          if (width && svg) Object.assign(svg.style, { width: `${width}px`, maxWidth: "" });
        })
        .catch(() => dom.replaceChildren(this.code(source, ""))),
    );
    return dom;
  }

  /**
   * An image: an attachment, a photo on Unsplash, or one on the web, at the width its label gives
   * (`|400`) if it does. A missing one says so.
   */
  image(src: string, label: string): HTMLElement {
    const img = el("img", "doc-image");
    const { alt, width } = imageSize(label);
    img.alt = alt || t("editor.image");
    if (width) {
      img.style.width = `${width}px`;
      img.style.maxHeight = "none";
    }
    const missing = (message: string) => img.replaceWith(el("span", "doc-image-missing", message));
    const loaded = (url: string) =>
      new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => {
          missing(t("editor.imageFailed"));
          resolve();
        };
        // An image that never answers doesn't hold up the pages.
        setTimeout(resolve, 15000);
        img.src = url;
      });
    const name = attachmentName(src);
    if (name) {
      this.#later(
        attachmentURL(name).then((url) => {
          if (url) return loaded(url);
          missing(t("editor.imageNotHere"));
        }),
      );
    } else this.#later(loaded(unsplashImage(src) ?? src));
    return img;
  }

  /** An icon, as the app draws it (Lucide, so it prints the same everywhere). */
  icon(name: IconName, size = 15): HTMLElement {
    const span = el("span", "doc-icon");
    this.#icons.push(mount(Icon, { target: span, props: { name, size, set: "lucide" } }));
    return span;
  }
}
