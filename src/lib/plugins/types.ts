import type { LanguageDescription } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { MarkdownConfig } from "@lezer/markdown";
import type { Component } from "svelte";
import type { SlashCommand } from "../editor/slashCommands";
import type { IconName } from "../icons/icons";
import type { NoteStats } from "../notes/stats";
import type { NoteMeta } from "../notes/types";
import type { Parts } from "../print/parts";

/*
 * What a plugin is, and what it can add to lines (docs/plugins.md). lines' own languages, themes,
 * icon sets and engines are plugins too: the core knows them only through what's here. A plugin
 * module exports a function that returns its Plugin, called once lines has started.
 */

export interface Plugin {
  /** Unique and lasting: it's what's saved when someone turns the plugin on or off. */
  id: string;
  /** Its name and what it does, in the app's language, for Settings → Plugins. */
  name: string;
  description: string;
  icon: IconName;
  /** On until turned off, as lines' own plugins are; false waits to be turned on. */
  enabledByDefault: boolean;
  /** lines can't do without it, so it can't be turned off. */
  required?: boolean;
  /** The plugins it needs, by id; it's off while any of them is. */
  requires?: string[];
  /** Plugins that do the same work, by id (two engines for the same blocks): turning it on turns them off. */
  alternatives?: string[];
  /** Whether it can work here (SF Symbols, only in the Apple apps), and if not, where it does. */
  available?: boolean;
  availability?: string;
  contributes: Contributions;
}

/** What a plugin adds. Every part is optional, and a plugin can add several kinds of things. */
export interface Contributions {
  /** Markup languages notes can be written in. */
  languages?: NoteLanguage[];
  /** Color themes, each with a light and a dark side. */
  themes?: Theme[];
  /** Ways to draw the icons lines uses. */
  iconSets?: IconSet[];
  /** Engines that draw math, `$x^2$` or `\[…\]`, in notes of any language. */
  math?: MathEngine[];
  /** Engines that draw a code block of their language as a picture: ```mermaid as a diagram. */
  renderers?: Renderer[];
  /** Ways to show attached files of some kinds in a note, rather than as a card naming them: a 3D model to turn. */
  files?: FileView[];
  /** Ways to make a note's PDF other than lines' own pages, like TeX for LaTeX notes. */
  typesetters?: Typesetter[];
  /** Engines that work out formulas (`=SUM(B2:B4)`) in tables and spreadsheets. */
  formulas?: FormulaEngine[];
  /** New syntax for Markdown notes: block types and marks within text, and their "/" commands. */
  markdown?: MarkdownAddition[];
  /** How code blocks in more languages are highlighted, in the editor and on paper: ```http. */
  codeLanguages?: LanguageDescription[];
  /** Links to a site that read short, the way the site writes them: GitHub's `owner/repo#12`. */
  links?: ShortLinks[];
  /** Where research papers are found, to search from a note and link to: arXiv. */
  papers?: PaperSource[];
}

/**
 * Links to a site, drawn short with the site's mark in front, in notes of any format and on paper.
 * The note keeps the whole address, which shows again while the cursor is on it.
 */
export interface ShortLinks {
  id: string;
  /** The mark in front, as SVG markup drawn in the text's color (`fill="currentColor"`). */
  mark: string;
  /** How a link reads in short (`overtio/lines#12`), or null for one that stays as it is. */
  text(url: URL): string | null;
}

/** One page of what a search on the web found, and whether there are more. */
export interface SearchPage<T> {
  items: T[];
  more: boolean;
}

/** A research paper, as a source found it. */
export interface Paper {
  /** The source's own name for it, unique among what it finds: arXiv's `1706.03762`. */
  id: string;
  title: string;
  /** Its authors' names, in order. */
  authors: string[];
  /** The year it came out. */
  year?: number;
  /** Where it's from, said after the year: arXiv's category (`cs.CL`), or a journal. */
  venue?: string;
  /** Where the note links to: its page, with its abstract. */
  url: string;
}

/**
 * A place research papers are found. Each is searched from Markdown and LaTeX notes with "/paper",
 * which links to the paper chosen.
 */
export interface PaperSource {
  id: string;
  /** As people know it: "arXiv". */
  name: string;
  /** Said under its search, linking to it, as its terms ask. `title` is more, shown on hover. */
  credit: { text: string; href: string; title?: string };
  /**
   * One page (1 for the first) of the papers `query` finds: words, an author, or how the source
   * names a paper (`1706.03762`, a link to it). With no query, nothing.
   */
  search(query: string, page: number, signal: AbortSignal): Promise<SearchPage<Paper>>;
}

/** A markup language notes can be written in. Nothing in lines outside its plugin knows how it reads. */
export interface NoteLanguage {
  /** What a note written in it keeps as its format, here and in synced files: "latex". */
  id: string;
  /** As people know it: "LaTeX". */
  name: string;
  /** Its file extensions, the usual one first, which exports and downloads use. */
  extensions: string[];
  mimeType: string;
  /** How the editor reads it and draws it as you type, and its keys and commands (CodeMirror extensions). */
  editor(): Extension;
  /** What the note list, sidebar and search know of a note: its title, excerpt, tags, open todos… */
  meta(body: string): NoteMeta;
  /** The note as plain text, without markup, for copying and sharing. */
  plainText(body: string): string;
  /** Its words, sentences and paragraphs as a reader counts them, for the note's ⓘ panel. */
  stats(body: string): NoteStats;
  /** The note with `#tag` added, where this language keeps tags. */
  addTag(body: string, tag: string): string;
  /** A new note's text, made in the sidebar's tag or type, if it was. */
  newNote(made: { tag?: string; type?: string }): string;
  /**
   * A note as a file of its own, the way exports and downloads write it: as it is, unless the
   * language needs more to stand alone. With `attachments`, links to its images and files point
   * into that folder instead.
   */
  file(body: string, attachments?: string): string;
  /** The note laid out as a document, for its PDF, printing and images (print/). */
  print(body: string, parts: Parts): HTMLElement;
  /**
   * For a language whose notes copy and download as something other than their text as written:
   * what that's called, and the note as it ("CSV", a spreadsheet's cells without its title).
   */
  copyAs?: { name: string; text(body: string): string };
  /** Other files its notes can be downloaded as, besides their own: a spreadsheet as an Excel workbook. */
  exports?: NoteExport[];
  /** Other extensions it can make notes from (an Excel workbook's), besides its own. */
  opens?: string[];
  /** The notes a file of its extensions makes, if not one with the file's text as it is. */
  read?(file: { name: string; data: Uint8Array }): Promise<string[]>;
}

export interface NoteExport {
  /** What the share menu says: "Download Excel Workbook". */
  label: string;
  icon: IconName;
  extension: string;
  mimeType: string;
  write(body: string): Promise<Uint8Array<ArrayBuffer>>;
}

/**
 * A theme's colors, by custom property without its `--` (app.css). These base colors are needed;
 * a theme can set any other property app.css has, which otherwise it works out from them.
 */
export interface ThemeColors {
  bg: string;
  "bg-list": string;
  "bg-sidebar": string;
  "bg-elevated": string;
  text: string;
  "text-sidebar": string;
  "text-muted": string;
  "text-faint": string;
  accent: string;
  "tag-text": string;
  /** What faint overlays (borders, hovers) are mixed from. */
  ink: string;
  [property: string]: string;
}

export interface Theme {
  id: string;
  name: string;
  /**
   * Made for low vision or color blindness: listed in a group of their own, and with faint text
   * readable enough for placeholders too.
   */
  accessible?: boolean;
  light: ThemeColors;
  dark: ThemeColors;
  /** What changes with Settings → Appearance → Contrast → Increased, or the device's Increase Contrast. */
  moreContrast?: { light?: Partial<ThemeColors>; dark?: Partial<ThemeColors> };
}

/** What every icon set draws: one of lines' icons, at a size in pixels. */
export interface IconProps {
  name: IconName;
  size: number;
  strokeWidth: number;
  class?: string;
}

export interface IconSet {
  id: string;
  name: string;
  /** Draws any of lines' icons (icons/icons.ts). It's decoration: screen readers skip it. */
  component: Component<IconProps>;
}

export interface MathEngine {
  id: string;
  name: string;
  /** Gets ready to draw, loading what it needs the first time. */
  load(): Promise<void>;
  /**
   * Draws `tex` into `dom`, displayed on its own or within text, with the note's own commands
   * (`\newcommand`) in `macros`. Throws, with what's wrong, on math it can't read.
   */
  render(dom: HTMLElement, tex: string, options: { display: boolean; macros: Record<string, string> }): void;
}

export interface Renderer {
  id: string;
  name: string;
  /** The code block languages it draws: ["mermaid"]. */
  languages: string[];
  /** What it draws, for screen readers: "Diagram". */
  label: string;
  /**
   * Draws a code block's `source`: on screen in the theme's colors, or for paper in black on white.
   * Resolves to SVG markup or an element; rejects, with what's wrong, on code it can't draw.
   * `note` is the whole note's text, when it's known, for what depends on the rest of the note.
   */
  render(source: string, options: { paper: boolean; note?: string }): Promise<string | Element>;
  /** Buttons on what it draws, like a diagram's "Copy and Edit as Drawing". */
  actions?: BlockAction[];
  /**
   * Attached files it makes one of its blocks from, as a CSV file makes a ```csv block: a button on
   * the file's card in a note puts the block in the file's place.
   */
  fromFiles?: BlockFromFile;
  /**
   * Draws its blocks in the editor as something to work in, instead of `render`'s picture, which
   * still prints: a ```csv block as a spreadsheet's grid. It's put into `dom`, in place of the
   * block's code, and writes what's changed back through `block`.
   */
  editor?(dom: HTMLElement, block: EditableBlock): BlockEditor;
}

/** A code block drawn in the editor as something to work in (`Renderer.editor`). */
export interface EditableBlock {
  readonly view: EditorView;
  /** Its code as written, kept up to date. */
  readonly source: string;
  /** Where it starts in the note now. */
  readonly from: number;
  /** Its name, written after its language (```csv name=costs), by which other blocks and notes can find it. */
  readonly name: string | null;
  readonly readOnly: boolean;
  /** Writes its code, as one step to undo. */
  write(source: string): void;
  /** Writes its name after its language, or takes it out (null). */
  rename(name: string | null): void;
  /** Out of it, into the note's text above it or below (a line is added below one that ends the note). */
  leave(up: boolean): void;
  /** Shows its code in place of what's drawn, the cursor at its start. */
  showCode(): void;
}

/** What a renderer's editor gives back for a block it's put into. */
export interface BlockEditor {
  /** Its code or name, the note around it, or whether the note is read-only, changed. */
  update(): void;
  /** Takes the keyboard, from the line above it (↓) or below (↑). */
  focus(from: "above" | "below"): void;
  /** The editor's size or text size changed. */
  layout?(): void;
  destroy(): void;
}

/**
 * Shows attached files of some kinds in a note, above the card naming them (a 3D model to turn, a
 * terminal recording to play), and on paper. An attached file is one on a line of its own, a link
 * to it: `[Bracket.stl](../attachments/…)`.
 */
export interface FileView {
  id: string;
  /** The extensions of the files it shows, in lowercase: ["stl", "obj"]. */
  extensions: string[];
  /** Shows a file in `dom`. */
  show(dom: HTMLElement, file: ViewedFile): Shown;
  /** A picture of the file, for paper; rejects, with what's wrong, on a file it can't read. Without it, the file prints as its name. */
  print?(file: ViewedFile): Promise<Element>;
}

export interface ViewedFile {
  /** The name it's attached as, which ends in its extension. */
  name: string;
  /** What it's called in the note, its link's text. */
  label: string;
  data: Blob;
}

/**
 * What a plugin shows of a file, or draws of a link, while it's in the note. Inside an element with
 * the class `cm-lp-own-input` (editor/util.ts), clicks and keys are its own, as a player's are.
 */
export interface Shown {
  /** Takes the keyboard, as Enter on it does while it's selected: a recording starts playing. */
  focus?(): void;
  destroy(): void;
}

export interface BlockAction {
  label: string;
  icon: IconName;
  /** `pos` is in the code block. */
  run(view: EditorView, pos: number): void;
}

/** How a renderer makes one of its blocks from an attached file (`Renderer.fromFiles`). */
export interface BlockFromFile {
  /** The files' extensions, in lowercase: ["csv", "tsv"]. */
  extensions: string[];
  /** What the file card's button says: "Convert to Spreadsheet". */
  label: string;
  icon: IconName;
  /** The block's code, and its name (from the file's, `name` being what the note calls it, with its extension), if it takes one. */
  read(file: { name: string; data: Uint8Array }): FileBlock | Promise<FileBlock>;
}

export type FileBlock = { code: string; name: string | null };

export type TypesetProgress = { phase: "download" | "compile"; percent?: number };

/**
 * A failure's first error, the whole log, and the note's line the error is on when the typesetter
 * says; `starting` when the typesetter itself couldn't start (its files didn't download).
 */
export type TypesetResult = { ok: true; pdf: Uint8Array } | { ok: false; error: string; log: string; line: number | null; starting?: boolean };

export interface Typesetter {
  id: string;
  name: string;
  /** The languages it typesets, by id. */
  languages: string[];
  /** What the first download weighs, said while it happens: "about 125 MB". */
  download?: string;
  /** Whether it can run in this build. */
  available(): Promise<boolean>;
  /** Makes a note's PDF from its text, saying how it's going. */
  typeset(body: string, progress: (progress: TypesetProgress) => void): Promise<TypesetResult>;
}

/** A cell as a formula engine works it out. */
export interface CellValue {
  /** As it shows: "1,650.50", "TRUE", "#DIV/0!". */
  text: string;
  kind: "empty" | "number" | "text" | "boolean" | "error";
}

/** A sheet kept by a formula engine, worked out again as its cells change. */
export interface FormulaSheet {
  /** Its cells as written ("12", "=SUM(B2:B4)"), by row; only what changed since last time is worked out again. */
  update(cells: string[][]): void;
  /** What a cell shows, by row and column from 0, including ones a formula spills into. */
  value(row: number, column: number): CellValue;
  free(): void;
}

/** Cells by row, as written: a sheet's, or a table's. */
export type Cells = string[][];

/** What can go at a place in a formula being written. Places count UTF-16 units, as strings do. */
export interface FormulaCompletion {
  /** A function's name is being typed: what's typed of it so far, starting at `from`. */
  name?: { typed: string; from: number };
  /** Inside a function's parentheses: which function, and which of its arguments (from 0). */
  argument?: { name: string; index: number };
  /** Whether a cell or a range of them can go here (after `=`, `(`, a comma, an operator). */
  reference: boolean;
}

/** A function an engine knows, for suggesting it. */
export interface FormulaFunction {
  name: string;
  /** What it does, in a sentence. */
  about: string;
  args: { name: string; about: string; optional: boolean; /** "…": as many more as wanted. */ more: boolean }[];
}

/** Cells from one corner to the other, by row and column from 0. */
export interface CellArea {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** A reference in a formula: where it's written (from–to), and the cells it points at. */
export interface FormulaReference extends CellArea {
  from: number;
  to: number;
}

/**
 * Another sheet a formula reaches into by name (`Budget!B4`), as found from the sheet it's in: the
 * same `id` however it's named, its cells, and how the names in its own formulas are found.
 */
export interface LinkedSheet {
  id: string;
  cells: Cells;
  find: FindSheet;
}

/** The sheet a name in a formula stands for, from where it's written; null if there's none. */
export type FindSheet = (name: string) => LinkedSheet | null;

export interface FormulaEngine {
  id: string;
  name: string;
  /** Gets ready, loading what it needs the first time. Everything else waits for it. */
  load(): Promise<void>;
  /** A sheet to work cells out in; `find` finds the other sheets its formulas name. */
  sheet(find?: FindSheet): FormulaSheet;
  /** `cells` with `count` rows or columns put in at `at` (taken out, if negative), formulas still pointing at the same cells. */
  shift(cells: Cells, axis: "row" | "column", at: number, count: number): Cells;
  /** `cells` with those in `area` moved `rows` down and `columns` across, as cutting and pasting them does: formulas pointing at them follow. */
  moveCells(cells: Cells, area: CellArea, rows: number, columns: number): Cells;
  /** A formula as it reads copied `rows` down and `columns` across: its relative references move with it. */
  move(formula: string, rows: number, columns: number): string;
  /** A formula with the other sheets it names (`Budget!B4`) called what `rename` returns for each name; those it returns nothing for stay as written. */
  renameSheets(formula: string, rename: (name: string) => string | undefined): string;
  /** What can go at `cursor` in a formula being written. */
  complete(formula: string, cursor: number): FormulaCompletion;
  /** The references in a formula to cells of its own sheet. */
  references(formula: string): FormulaReference[];
  /** Every function it knows, by name. */
  functions(): FormulaFunction[];
  /** The sheets of an Excel workbook, each cell as written (its formula, or its value as it shows). */
  readWorkbook?(data: Uint8Array): { name: string; cells: Cells }[];
  /** A sheet as an Excel workbook, with its formulas and their values, and the sheets they name (`find`) as more sheets. */
  writeWorkbook?(name: string, cells: Cells, find?: FindSheet): Uint8Array<ArrayBuffer>;
}

/** New syntax for Markdown notes (Linedown): a block type, or a mark within text. */
export interface MarkdownAddition {
  /** How the parser reads it: a @lezer/markdown extension. */
  syntax?: MarkdownConfig;
  /** How the editor draws it, and any keys it takes (CodeMirror extensions). */
  editor?: Extension;
  /** "/" commands that insert it. */
  commands?: SlashCommand[];
  /** How it prints: for each node its syntax adds, by name, what it prints as. */
  print?: Record<string, MarkdownPrinter>;
  /** Links on a line of their own drawn as something to watch or use: an asciinema recording as its player. */
  embeds?: Embed[];
}

/**
 * A link on a line of its own, drawn as something to watch or use in place of the link: a
 * recording's player, say. It's drawn where images and files are (attachments.ts), and is
 * selected, moved and deleted as they are.
 */
export interface Embed {
  id: string;
  /** Whether it draws this link. */
  draws(link: EmbedLink): boolean;
  /** Draws a link it draws into `dom`, calling `changed` whenever its size may have changed. */
  draw(dom: HTMLElement, link: EmbedLink, changed: () => void): Shown;
  /** What a link pasted on an empty line is written as, if it's one to draw: an address as its embed code. */
  paste?(href: string): string | null;
}

/** A link as Markdown writes it: `[text](href)`, an image `![label](image)`, or an image that links somewhere. */
export interface EmbedLink {
  /** Where it links; null for an image that doesn't. */
  href: string | null;
  /** The image it shows, if it's one. */
  image: string | null;
  /** Its text, or the image's description. */
  label: string;
}

/** Prints a node of the note; null prints nothing. */
export type MarkdownPrinter = (node: SyntaxNode, doc: MarkdownPrint) => Node | null;

/** What a printer can use to print a node's text and what's inside it, the way the rest prints. */
export interface MarkdownPrint {
  /** The note's text between two places. */
  slice(from: number, to: number): string;
  /** The text and marks inside `node`, printed into `into`. */
  inline(node: SyntaxNode, into: Node): void;
  /** The blocks inside `node`, printed into `into`. */
  blocks(node: SyntaxNode, into: HTMLElement): void;
  /** Math, code, pictures and icons, which take a moment to draw. */
  parts: Parts;
}
