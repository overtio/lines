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
  /** Ways to make a note's PDF other than lines' own pages, like TeX for LaTeX notes. */
  typesetters?: Typesetter[];
  /** New syntax for Markdown notes: block types and marks within text, and their "/" commands. */
  markdown?: MarkdownAddition[];
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
  /** What changes with Settings → Theme → Contrast → Increased, or the device's Increase Contrast. */
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
   */
  render(source: string, options: { paper: boolean }): Promise<string | Element>;
  /** Buttons on what it draws, like a diagram's "Copy and Edit as Drawing". */
  actions?: BlockAction[];
}

export interface BlockAction {
  label: string;
  icon: IconName;
  /** `pos` is in the code block. */
  run(view: EditorView, pos: number): void;
}

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
