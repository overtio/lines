import type { LanguageDescription } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { MarkdownConfig } from "@lezer/markdown";
import type { Component } from "svelte";
import type { PaletteColor } from "../palette";
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
  /**
   * Its own page in Settings, under Plugins: the settings it brings, shown below its switch while
   * it's on. Loaded the first time Settings opens. Named `<Id>Settings.svelte` (`MascotsSettings`),
   * its words are found by Settings' search.
   */
  settings?: () => Promise<{ default: Component }>;
  contributes: Contributions;
}

/** What a plugin adds. Every part is optional, and a plugin can add several kinds of things. */
export interface Contributions {
  /** Markup languages notes can be written in. */
  languages?: NoteLanguage[];
  /** Color palettes: named lists of colors, which themes are drawn in. */
  palettes?: Palette[];
  /** Color themes, each a palette and which of its colors each part of lines is drawn in, light and dark. */
  themes?: ThemeDefinition[];
  /** Whole looks for the app, beyond its colors: shapes, type, borders, shadows; each a preset (Settings → Presets). */
  styles?: AppStyle[];
  /** Fonts to write notes in (Settings → Typography → Font family), beside your system's. */
  fonts?: NoteFont[];
  /** Kinds of theme files made for other apps (VS Code, Base16, a terminal's) that lines can read themes from. */
  themeFormats?: ThemeFormat[];
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
  /** Paper to write on: patterns drawn behind a note (ruled lines, dots, squares), textures under them, and backdrops behind the page. */
  paperStyles?: PaperStyle[];
  /** What marks lines in a note's margin, as a code editor marks the lines changed. */
  markers?: MarkerSource[];
  /** Keyboards to hear as you type (Settings → Plugins → Keyboards). */
  keyboardSounds?: KeyboardSound[];
  /** Companions that live in the window, walk about and keep you company as you write (Settings → Plugins → Mascots). */
  mascots?: Mascot[];
  /** Pictures on the web to make a theme from, and the backdrop (Settings → Theme → New → From …). */
  pictureLibraries?: PictureLibrary[];
  /** Kinds of things kept in the library (books, movies, songs…), each a note's `type`, and its row in the sidebar's Library. */
  libraryKinds?: LibraryKind[];
  /** Where lines finds out what a link is, to fill a library note with it: a site's catalog, or any page's own description of itself. */
  librarySources?: LibrarySource[];
  /** What a web link in a note can be used for, in its menu (right-click it) after Open and Copy: added to the Library, say. */
  linkActions?: LinkAction[];
  /** Files lines imports as something other than a note in a language: a browser's bookmarks, as the Library's resources. */
  fileImports?: FileImport[];
}

/**
 * Files of a kind lines imports its own way (Settings → Export and Import → Import Files…), which
 * asks what to do with them before doing it: a browser's exported bookmarks.
 */
export interface FileImport {
  id: string;
  /** The extensions of its files, for the file picker. */
  extensions: string[];
  /** Whether a file's text is one it reads (its start is enough), quickly. */
  recognizes(text: string): boolean;
  /**
   * What says what importing the files would do, does it, and says what it did: rows of a card in
   * Settings, given the files' names and text, and what to call when it's done with (Cancel).
   */
  step: () => Promise<{ default: Component<{ files: { name: string; text: string }[]; onclose: () => void }> }>;
}

/** A web link in a Markdown note: its whole Markdown (`[text](…)`, `<…>` or a bare address), where it is, its address and its text. */
export interface WebLink {
  from: number;
  to: number;
  markdown: string;
  href: string;
  text: string;
}

/** Something to do with a web link in a note, from its menu (editor/linkMenu.ts). */
export interface LinkAction {
  label: string;
  icon: IconName;
  /** Whether it changes the note: if so, a note that can't be changed doesn't offer it. */
  edits?: boolean;
  run(view: EditorView, link: WebLink): void;
}

/**
 * What a source found out about something, before it's a note: lib/library/note.ts writes the note,
 * the same way for every way of adding one.
 */
export interface LibraryItem {
  /** Its kind's `type`: "book", "movie"… */
  type: string;
  title: string;
  /** The page it's from, as the page names itself where it says. */
  link?: string;
  /** Its properties, in the order they're written, before `link` and `status`: `["author", "Frank Herbert"]`. */
  properties: [key: string, value: string][];
  /** A picture of it (a poster, a cover, artwork), downloaded and kept with the note. */
  cover?: string;
  /** What it's about, in a few plain sentences. */
  description?: string;
  /** Tags it's filed under (a bookmark's), written as the note's `#tags`: lines' own, as `normalizeTag` makes them. */
  tags?: string[];
}

/**
 * A kind of thing in the library: a note's `type`, and the row its notes are listed under in the
 * sidebar's Library. `type`, the property keys and `status` values are stable English words, the
 * same on every device; the names are in the app's language.
 */
export interface LibraryKind {
  /** The note's `type`: "book". */
  type: string;
  /** One of them: "Book". */
  name: string;
  /** Its row in the Library, in the sidebar: "Books". */
  label: string;
  icon: IconName;
  /**
   * Another kind's type, whose row it's listed in: an album's is "song", so both are Music. False
   * for no row: a feed's notes are subscriptions, and the Library's Feeds lists them by their posts.
   */
  shelf?: string | false;
  /** Its properties' keys, in the order its notes have them, before `link` and `status`. */
  properties: string[];
  /** What its rows show under their titles, by key, those it has joined with " · ": author and year. */
  subtitle: string[];
  /** The shape its covers come in, which its rows show them in: a book's tall, an album's square (the first), a video's wide. */
  cover?: "square" | "tall" | "wide";
  /** Its properties whose value is another note's title (an episode's `podcast`), which its notes write as a mention of it. */
  mentions?: string[];
  /** Where it's got to, in order (the first is where it starts): what's written, and what's shown. None for kinds without (a podcast). */
  statuses?: { value: string; label: string }[];
  /**
   * Its notes are a link and its name so far (a bookmark): their row's menu has Look Up Details, which
   * makes one what its link is (a book, a video…) where a source knows it, keeping its properties
   * and tags.
   */
  lookUp?: boolean;
}

/**
 * Where lines finds out what a link is. Sources are asked in turn, those for a site first and then
 * the `general` ones, and the first to recognize the link and find what it is fills the note.
 * Only what's needed is sent: the link, or an id read from it.
 */
export interface LibrarySource {
  id: string;
  /** As people know it: "Open Library". */
  name: string;
  /** Reads any page rather than a site's, so it's asked after the rest. */
  general?: boolean;
  /**
   * Plugins it needs running, by id, besides its own: until they are, it isn't asked, nor named
   * among the sources that work (a site's feed, found by reading its page, needs Web Pages, which
   * reads pages: only in the apps, and only while it's on).
   */
  requires?: string[];
  /** Whether it's a link it knows; quick, and without asking anyone. */
  recognizes(url: URL): boolean;
  /** What the link is, or null if it isn't something the library keeps. Rejects when it can't be asked (offline). */
  lookup(url: URL, signal: AbortSignal): Promise<LibraryItem | null>;
  /** The kinds it can search for, by type, in Add to Library. */
  searches?: string[];
  /**
   * What `text` (a title, a name) finds of things of `type`, the best first: as much as a search
   * says of each (a small `cover`, its `link`), the rest looked up by its link once one is chosen.
   */
  search?(type: string, text: string, signal: AbortSignal): Promise<LibraryItem[]>;
}

/** A font to write notes in, which the plugin brings with it (`@font-face`) so it's there on every computer. */
export interface NoteFont {
  /** Lowercase letters, digits and dashes. */
  id: string;
  /** What it's called: "IBM Plex Sans". */
  name: string;
  /** Its CSS font-family, with fonts to fall back on. */
  family: string;
}

/** The poses a mascot is drawn in. */
export type MascotPose = "stand" | "walk1" | "walk2" | "sit" | "sleep" | "cheer";

/**
 * A companion that lives in the window: pixel art in a few poses, which lines walks about the note,
 * sits beside the line you're writing, puts to sleep and has react (lib/mascot/).
 */
export interface Mascot {
  id: string;
  name: string;
  /** What it's like, under its name in Settings. */
  description?: string;
  /**
   * Its poses, facing right: pixel art, a row a line, each character a color from `palette` (`.`
   * see-through), all as wide and as tall as the rest. A pose can be another with its eyes shut.
   */
  frames: Record<MascotPose, string[] | { like: MascotPose; closed: true }>;
  /**
   * Its colors by character: CSS colors, or `accent` and `accent-dark` for the theme's. `e` is its
   * eyes and `i` their shine, which a blink turns to `lid`'s color, leaving a line.
   */
  palette: Record<string, string>;
  lid: string;
  /** How it gets about: on foot, floating (bobbing as it goes), or hopping. */
  moves: "walk" | "float" | "hop";
  /** What it says, its own way ("mrrp"), besides what lines has every mascot say. */
  sounds?: string[];
}

/**
 * A keyboard to hear as you type: its sounds, made or read for an audio context the first time
 * it's chosen. Sound packs of your own (Mechvibes') are listed after the plugins' keyboards.
 */
export interface KeyboardSound {
  id: string;
  name: string;
  /** What it sounds like, or who recorded it, under its name in Settings. */
  description?: string;
  load(context: BaseAudioContext): Promise<KeySounds>;
}

/** A keyboard's sounds, by the key (`KeyboardEvent.code`, `KeyA`) going down and coming back up. */
export interface KeySounds {
  press(code: string): KeyClip | undefined;
  release(code: string): KeyClip | undefined;
}

/** A sound: a buffer, or the part of one from `offset` for `duration` seconds. */
export interface KeyClip {
  buffer: AudioBuffer;
  offset?: number;
  duration?: number;
}

/** The colors a line can be marked in: the theme's accent, or one of its palette (palette.ts). */
export type MarkerColor = PaletteColor;

/** Lines marked in the margin beside a note. */
export interface LineMarker {
  /** The first line marked, from 1, and the last (the same, if left out). */
  from: number;
  to?: number;
  color: MarkerColor;
  /** What the mark means, shown on pointing at it. */
  label?: string;
  /** A small wedge at the top of `from` instead of a bar beside it: where lines were taken out. */
  between?: boolean;
}

/**
 * Marks lines in a note's margin, beside the note's own marks (each source in a lane of its own).
 * Asked as the note changes, with its text then and as it was when it was opened, so it has to be
 * quick: it runs on every change.
 */
export interface MarkerSource {
  id: string;
  markers(note: { text: string; opened: string; format: string }): LineMarker[];
}

/** A mark written in a note, at the end of a line: where it starts in the line, its color and what it says. */
export interface WrittenMark {
  at: number;
  color: MarkerColor;
  label?: string;
}

/** One background layer, as CSS's `background` takes them: an image, its size and where it starts. */
export interface PaperLayer {
  image: string;
  size: string;
  position?: string;
}

/**
 * Paper a note's page can look like (Settings → Plugins → Paper): a pattern drawn behind the text, a texture
 * under it, or a backdrop behind the page, one of each at a time. Patterns draw in `--paper-color`
 * (the theme's ink, its accent, or a color chosen) at `--paper-opacity` (0 to 1: a line's, more for
 * what's smaller), every `--paper-step`: a line of text, or the size chosen. A texture is told the
 * scheme it's shown in, and so is a backdrop, which fills the space around the page.
 */
export interface PaperStyle {
  id: string;
  /** In the app's language: "Dots". */
  name: string;
  kind: "pattern" | "texture" | "backdrop";
  /** Drawn across the page (around it, for a backdrop). */
  layers?(scheme: "light" | "dark"): PaperLayer[];
  /**
   * Drawn under each line of the note instead, in tiles `1lh` high (the line's own height) and
   * `--paper-step` wide: rows the text sits in, one per line, headings and wrapped lines too. Used
   * while Spacing follows the text, and always by a pattern without `layers` (ruled lines). In
   * `--paper-color`, so the same in light and dark.
   */
  lineLayers?(): PaperLayer[];
  /** With `lineLayers`, what's drawn down the whole text column from its left edge, unbroken by lines: a grid's columns. */
  columnLayers?(): PaperLayer[];
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

/** A picture a library found. */
export interface FoundImage {
  id: string;
  /** A small version, for the picker. */
  thumb: string;
  /** Its color while the thumbnail loads, if the library says. */
  color?: string;
  /** Who made it, shown over it in the picker. */
  by?: string;
  /** Its address and description in the note: `![alt](src)`. */
  src: string;
  alt: string;
}

export interface ImageLibrary {
  /** As it's known: "Unsplash". */
  name: string;
  /** The credit under the picker, linking to the library ("Powered by GIPHY"). */
  credit: { text: string; href: string };
  /**
   * One page (1 for the first) of what `query` finds, or with no query what's featured, and
   * whether there are more pages.
   */
  search(query: string, page: number, signal: AbortSignal): Promise<SearchPage<FoundImage>>;
  /** Told which picture went in the note, for libraries that count them (Unsplash). */
  chosen?(image: FoundImage): void;
}

/**
 * A library whose pictures can be had whole, not only shown from it: a picture chosen in a note is
 * kept with it, and one can be a theme's colors and the backdrop (Settings → Theme → New).
 */
export interface PictureLibrary extends ImageLibrary {
  /** The picture itself, as large as the library has it. */
  picture(image: FoundImage, signal?: AbortSignal): Promise<Blob>;
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
  /** What it's about, if the source says. */
  abstract?: string;
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

/**
 * Where a new note was made: under a tag or a type in the sidebar, or on the Calendar, which gives
 * it properties (`date`, or an event's `type`, `start` and `end`).
 */
export interface Made {
  tag?: string;
  type?: string;
  properties?: Record<string, string>;
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
  /**
   * How the editor reads it and draws it as you type, and its keys and commands (CodeMirror
   * extensions): the same each time it's asked, unless they should change.
   */
  editor(): Extension;
  /** What the note list, sidebar and search know of a note: its title, excerpt, tags, open todos… */
  meta(body: string): NoteMeta;
  /** The note as plain text, without markup, for copying and sharing. */
  plainText(body: string): string;
  /** Its words, sentences and paragraphs as a reader counts them, for the note's ⓘ panel. */
  stats(body: string): NoteStats;
  /** The note with `#tag` added, where this language keeps tags. */
  addTag(body: string, tag: string): string;
  /**
   * The note with its title changed by `mark`, given the title as written, where this language
   * keeps one apart from the text (a LaTeX document's `\title{…}`); null for a note without one.
   * For a conflicted copy's title: without it, the line the title is read from is marked.
   */
  markTitle?(body: string, mark: (title: string) => string): string | null;
  /** A new note's text, made in the sidebar's tag or type, or on a day of the Calendar, if it was. */
  newNote(made: Made): string;
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
  /**
   * How a line is marked in its notes by whoever writes them (Mark Lines, ⌘⇧M): something at the
   * line's end that other apps don't show, like a comment. `read` finds one in a line's text, if it
   * has one; `skip` says where one isn't a mark after all (in code), asked again as the note changes
   * around it; and `write` makes one.
   */
  lineMarks?: {
    read(text: string): WrittenMark | null;
    skip?(state: EditorState, pos: number): boolean;
    write(color?: MarkerColor, label?: string): string;
  };
  /**
   * Formats that are kinds of one thing (Code, in each programming language), shown in a note's ⓘ
   * panel as one choice and then which; `default` is the one chosen first.
   */
  group?: { id: string; name: string; default: string };
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

/**
 * A palette: the colors a theme is drawn in, as Nord's sixteen are, 4 to 32 of them as a rule. A
 * theme says which is for what; their shades are worked out, not listed.
 */
export interface Palette {
  /** Unique and lasting: what themes refer to it by. */
  id: string;
  name: string;
  /** Who made it, for a well-known palette or one someone shared. */
  author?: string;
  colors: PaletteEntry[];
}

/** One of a palette's colors. */
export interface PaletteEntry {
  /** Lasting and never shown: what themes refer to it by, so renaming or changing it keeps them. */
  id: string;
  /** Its own name (Nord's "Polar Night 1"); without one, lines names it from its color ("Teal"). */
  name?: string;
  /** Hex or `rgb()`, as `parse` in themes/color.ts reads it, so lines can work out shades of it. */
  color: string;
}

/** Which of a palette's colors each part of lines is drawn in: palette colors' ids, by ThemeColors' keys. */
export type ThemeAssignment = Record<string, string>;

/**
 * A color theme as a plugin gives it, and as yours are kept: a palette, and for light, dark or both,
 * which of its colors each part of lines is drawn in. The rest is worked out from those
 * (themes/palette.ts, app.css), and the registry lists it as a Theme.
 */
export interface ThemeDefinition {
  id: string;
  name: string;
  /** Who made it, for a theme someone shared. */
  author?: string;
  /**
   * Made for low vision or color blindness: listed in a group of their own, and with faint text
   * readable enough for placeholders too.
   */
  accessible?: boolean;
  /**
   * Its palette's id; or one for each scheme, where its light and dark colors are separate palettes,
   * as families of themes publish them (Catppuccin Latte and Mocha). Each scheme's parts are drawn in
   * its own palette's colors.
   */
  palette: string | { light: string; dark: string };
  /**
   * Its parts' colors for a scheme. A theme with only one, as most made for other apps are, is shown
   * in it whatever Settings → Theme → Light or dark says.
   */
  light?: ThemeAssignment;
  dark?: ThemeAssignment;
  /**
   * Custom properties it sets beside its colors, made from them alone (`var(--ink)`): how much of a
   * color a mix takes (`color-mix(in srgb, var(--ink) 62%, transparent)`), callouts' tint, shadows.
   */
  properties?: Partial<Record<"light" | "dark", Record<string, string>>>;
}

/** A theme as lines shows it: its definition, worked out into colors for light and dark. */
export interface Theme {
  id: string;
  name: string;
  /** Who made it, for a theme someone shared. */
  author?: string;
  /** For a theme with colors for one scheme only: it's shown in that one, and its `light` and `dark` are the same. */
  scheme?: "light" | "dark";
  accessible?: boolean;
  light: ThemeColors;
  dark: ThemeColors;
  /** What changes with Settings → Theme → Contrast → Increased, or the device's Increase Contrast. */
  moreContrast?: { light?: Partial<ThemeColors>; dark?: Partial<ThemeColors> };
  /** What it's made of: its palette, and which of its colors each part is drawn in. */
  definition: ThemeDefinition;
}

/**
 * A look for the whole app, beside the colors a theme gives it: its corners, type, borders and
 * shadows, and what makes it itself, a 90s desktop's bevels or a neon glow. The app's parts are made
 * from tokens (app.css) a style sets, and carry `data-ui` (`button`, `field`, `menu`…) for the rest.
 */
export interface AppStyle {
  id: string;
  name: string;
  /** What it's like, in a few words, under its name in Settings. */
  description?: string;
  /** The color theme it's made with, chosen with it; any other can be chosen after. */
  theme?: string;
  /**
   * Its preset's other settings, by their names in lines' settings (docs/themes.md lists them):
   * `{ caretShape: "block", pointerStyle: "retro" }`. Those it leaves out are lines' own.
   */
  settings?: Record<string, unknown>;
  /** Its own font, for the app and as notes' first font in Settings → Typography: what it's called, and its CSS font-family. */
  font?: { name: string; family: string };
  /** Its own font for notes' headings, where it isn't the text's: what Settings → Typography → Fonts for formatting's first choice for them is. */
  headingFont?: { name: string; family: string };
  /**
   * Custom properties it sets, by name: the radii (`radius-sm` … `radius-xl`), shadows (`card-shadow`,
   * `shadow-menu`, `shadow-dialog`, `shadow-segment`), fonts (`font-system`, `font-mono`), heights
   * (`control`, `row`).
   */
  properties?: Record<string, string>;
  /**
   * CSS for the rest, shown only while it's chosen: every rule's selector starts with
   * `:root[data-style="<id>"]`. Comes after the app's own, so it outranks it.
   */
  css?: string;
}

/**
 * A kind of theme file made for another app, which lines reads themes from (Settings → Theme →
 * Import). Several formats can share an extension (`.json`), so each says whether a file is its own.
 */
export interface ThemeFormat {
  id: string;
  /** What it's called where formats are listed: "VS Code". */
  name: string;
  /** The extensions its files have, without the dot; tried first for files with these. */
  extensions: string[];
  /** The themes in a file's text, or none if it isn't one of this format's. */
  read(text: string, fileName: string): Promise<ImportedTheme[]>;
}

/** One theme as a file made for another app has it: colors for one scheme, light or dark. */
export interface ImportedTheme {
  name: string;
  author?: string;
  colors: ImportedColors;
}

/**
 * What a theme made for another app says its colors are for, as much of it as it has: lines makes
 * a palette of them and works the rest out (`importedColors` in themes/palette.ts), and whether it's
 * light or dark from its background. Any color CSS can read, or hex without the `#`.
 */
export interface ImportedColors {
  background: string;
  foreground: string;
  /** The panel beside the text, like an editor's file tree: lines' sidebar. */
  sidebar?: string;
  sidebarForeground?: string;
  /** Menus, popovers and dialogs. */
  elevated?: string;
  /** Secondary text, and fainter text still (placeholders, line numbers). */
  muted?: string;
  faint?: string;
  /** Links, buttons and what's chosen. */
  accent?: string;
  danger?: string;
  success?: string;
  warning?: string;
  info?: string;
  /** The colors of a terminal's palette, or Base16's. */
  hues?: Partial<Record<"red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "magenta", string>>;
  /** What code is highlighted in. */
  syntax?: Partial<Record<"keyword" | "string" | "number" | "comment" | "function" | "type", string>>;
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
