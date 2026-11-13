import { locale, t } from "./i18n/index.svelte";
import { isMacApp } from "./platform";
import { CURRENCIES, DATE_STYLES, type DateStyle, localCurrency, MONEY_STYLES, type MoneyStyle, NEGATIVE_STYLES, type NegativeStyle } from "./sheets/display";
import { type FormattingFonts, readFormattingFonts, sameFormattingFonts } from "./themes/formattingFonts";
import { familyName, installedFamily } from "./themes/installedFonts";
import { announce, onAnnounce, windowLabel } from "./windows/channel";

export type Appearance = "system" | "light" | "dark";
/** Standard colors, or text and borders darkened for contrast (each theme's `moreContrast`); "system" follows the device's Increase Contrast. */
export type Contrast = "system" | "standard" | "more";
/** One of FONTS, or a font a plugin brings (themes/fonts.svelte.ts). */
export type FontId = string;
/** Whether a floating note shows its close/minimize/zoom buttons all the time, or on hover. */
export type WindowButtons = "hover" | "always";
/** What of the main window its opacity makes see-through: all of it, the sidebar and the note list, or the sidebar. */
export const SEE_THROUGH = ["window", "lists", "sidebar"] as const;
export type SeeThrough = (typeof SEE_THROUGH)[number];
/** Which panes show in the theme's dark colors while the window's light: none, the sidebar, the note list, or both. */
export const DARK_PANES = ["none", "sidebar", "list", "both"] as const;
export type DarkPanes = (typeof DARK_PANES)[number];
/** Which way a note moves when swiped with two fingers on a trackpad. */
export type SwipeDirection = "fingers" | "reversed";
/** Where new notes go: the Inbox, to be sorted later, or straight among the rest. */
export const NEW_NOTES = ["inbox", "notes"] as const;
export type NewNotes = (typeof NEW_NOTES)[number];
/** The day the Calendar's weeks start on: where the language says, or a chosen one. */
export const WEEK_STARTS = ["auto", "monday", "sunday", "saturday"] as const;
export type WeekStart = (typeof WEEK_STARTS)[number];
/** What the Calendar shows beside its month, while no note is open: a week or a day, by the hour. */
export const CALENDAR_VIEWS = ["week", "day"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];
/** How often feeds are fetched again while lines is open, in minutes; 0 for only when asked (Settings → Library). */
export const FEED_REFRESH = [15, 30, 60, 240, 0] as const;
export type FeedRefresh = (typeof FEED_REFRESH)[number];
/** The paper a note's PDF is laid out on. */
export type Paper = "a4" | "letter";
/** Which side of the window a pane goes on. */
export type Side = "left" | "right";
/** How far apart a paper pattern's lines and dots are (Settings → Plugins → Paper): a row of cells for each line of text, or a size chosen. */
export type PaperSpacing = "text" | "custom";
/** How a score (`Rating: 4/5`) is drawn: as marks of one of these kinds, or as written (editor/scores.ts). */
export const SCORE_STYLES = ["stars", "hearts", "circles", "off"] as const;
export type ScoreStyle = (typeof SCORE_STYLES)[number];

/** How a note shows its Markdown (editor/markupMode.ts). */
export const MARKDOWN_MODES = ["source", "visible", "live", "hidden"] as const;
export type MarkdownMode = (typeof MARKDOWN_MODES)[number];
/** What color a paper pattern is drawn in: the theme's ink or accent, or one of your own. */
export type PaperColor = "ink" | "accent" | "custom";
/** The text cursor (Settings → Cursor, cursors.svelte.ts): its shape, color, blink, how it moves, and what it does as you type. */
export const CARET_SHAPES = ["bar", "thick", "block", "underline"] as const;
/** How wide a block or underline is: the letter it's on, or always a letter's width. */
export const CARET_WIDTHS = ["letter", "even"] as const;
export const CARET_COLORS = ["accent", "text", "custom"] as const;
export const CARET_BLINKS = ["smooth", "steps", "off"] as const;
export const CARET_MOTIONS = ["jump", "glide", "trail"] as const;
export const CARET_EFFECTS = ["none", "glow", "rainbow", "sparks"] as const;
/** The pointer: the system's, pixel art, or a dot in the accent; and what follows it. */
export const POINTER_STYLES = ["system", "retro", "dot"] as const;
export const POINTER_TRAILS = ["none", "comet", "sparkles"] as const;
/** A mascot's size, as how many screen pixels each of its pixels takes. */
export const MASCOT_SIZES = ["small", "medium", "large"] as const;

/** Headings' color: the theme's for each level ("text", as it was named when that was the text's), its accent, or one of your own. */
export const HEADING_COLORS = ["text", "accent", "custom"] as const;
export type HeadingColor = (typeof HEADING_COLORS)[number];

/** What a click on a link in a note does (editor/links.ts): web links (and attached files), tags, and mentions of notes. */
export type LinkKind = "web" | "tag" | "mention";
export type LinkClick = "click" | "modClick" | "modShiftClick";
export type LinkAction = "edit" | "open" | "newTab" | "backgroundTab" | "window" | "copy";
export type LinkClicks = Record<LinkKind, Record<LinkClick, LinkAction>>;

/** What each kind of link can do; "edit" puts the cursor there, as a click on text does. */
export const LINK_ACTIONS: Record<LinkKind, readonly LinkAction[]> = {
  web: ["edit", "open", "copy"],
  tag: ["edit", "open"],
  mention: ["edit", "open", "newTab", "backgroundTab", "window"],
};
export const LINK_CLICKS: readonly LinkClick[] = ["click", "modClick", "modShiftClick"];

export const FONTS: { id: FontId; name: string; family: string }[] = [
  { id: "system", name: t("settings.fontSystem"), family: "var(--font-system)" },
  { id: "serif", name: t("settings.fontSerif"), family: "var(--font-serif)" },
  { id: "rounded", name: t("settings.fontRounded"), family: "var(--font-rounded)" },
  { id: "mono", name: t("settings.fontMono"), family: "var(--font-mono)" },
];

export interface Spacing {
  /** Line height, as a multiple of the text size. */
  lineHeight: number;
  /** Height of the blank line between paragraphs, as a share of a normal line. */
  paragraph: number;
  /** Space above and below headings, as a multiple of the default. */
  headings: number;
  /** Extra space under the note's first line, in px. */
  title: number;
  /** Space on either side of the text, in px. Phones use half. */
  margin: number;
  /** Space above the first line, in px. */
  top: number;
}

// How settings' values are written beside their sliders, the app's language's way ("80 %" in French).
const percentFormat = new Intl.NumberFormat(locale, { style: "percent" });
const decimalFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatPercent = (value: number) => percentFormat.format(value);
// Not grouped by thousands, so a width reads 1200px as it always has.
export const formatPixels = (value: number) => t("settings.pixels", { value: String(value) });
/** A size as a screen reader says it: "24 pixels", not "24 p x". */
export const spokenPixels = (value: number) => t("settings.pixelsSpoken", { count: value });

export const SPACING_FIELDS: {
  key: keyof Spacing;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  /** How a screen reader says the value, where that differs from how it's written. */
  spoken?: (value: number) => string;
}[] = [
  { key: "lineHeight", label: t("settings.lineHeight"), min: 1.2, max: 2.2, step: 0.05, format: (v) => decimalFormat.format(v) },
  { key: "paragraph", label: t("settings.paragraphSpacing"), min: 0.2, max: 1.6, step: 0.05, format: formatPercent },
  { key: "headings", label: t("settings.headingSpacing"), min: 0, max: 2.5, step: 0.1, format: formatPercent },
  { key: "title", label: t("settings.titleSpacing"), min: 0, max: 48, step: 2, format: formatPixels, spoken: spokenPixels },
  { key: "margin", label: t("settings.sideMargins"), min: 12, max: 120, step: 4, format: formatPixels, spoken: spokenPixels },
  { key: "top", label: t("settings.topMargin"), min: 0, max: 120, step: 4, format: formatPixels, spoken: spokenPixels },
];

export const SPACING_PRESETS: { id: string; name: string; spacing: Spacing }[] = [
  {
    id: "compact",
    name: t("settings.spacingCompact"),
    spacing: { lineHeight: 1.45, paragraph: 0.5, headings: 0.6, title: 0, margin: 24, top: 8 },
  },
  {
    id: "default",
    name: t("settings.spacingDefault"),
    spacing: { lineHeight: 1.65, paragraph: 1, headings: 1, title: 4, margin: 40, top: 24 },
  },
  {
    id: "relaxed",
    name: t("settings.spacingRelaxed"),
    spacing: { lineHeight: 1.85, paragraph: 1.2, headings: 1.4, title: 12, margin: 64, top: 48 },
  },
];

export const DEFAULT_SPACING = SPACING_PRESETS[1].spacing;

/** The size of a note's text, in px (Settings → Typography → Text size, and ⌘+ and ⌘−). */
export const TEXT_SIZE = { min: 12, max: 28, step: 1 };

/** How wide a note's text can run, in px (Settings → Typography → Note width), and its choices besides Full. */
export const NOTE_WIDTH = { min: 480, max: 1400, step: 20 };
export const NOTE_WIDTHS = [
  { id: "narrow", name: t("settings.widthNarrow"), width: 600 },
  { id: "medium", name: t("settings.widthMedium"), width: 720 },
  { id: "wide", name: t("settings.widthWide"), width: 960 },
] as const;

export function sameSpacing(a: Spacing, b: Spacing) {
  return SPACING_FIELDS.every(({ key }) => Math.abs(a[key] - b[key]) < 1e-6);
}

/*
 * Themes, icon sets and typesetters come from plugins, so they're kept by id as chosen, even while
 * their plugin is off; lines shows its own until it's on again (plugins/registry.svelte.ts).
 */
export interface Stored {
  theme: string;
  /** The app's shapes, type and borders beside its colors, a plugin's style, by id: what a preset brings. */
  style: string;
  /** The preset last chosen (Settings → Presets, themes/presets.svelte.ts), by id. */
  preset: string;
  /** Where Settings opens in the desktop apps (windows/settings.svelte.ts). */
  settingsOpens: SettingsOpens;
  appearance: Appearance;
  contrast: Contrast;
  /** Every color of the theme shown as a grey, or turned light for dark (themes/show.svelte.ts). */
  monochrome: boolean;
  invert: boolean;
  darkPanes: DarkPanes;
  font: FontId;
  /** A font installed on this device notes are in, by its family name, in place of `font` (which older versions of lines show); "" for none. */
  installedFont: string;
  /** Fonts of their own for formatting (themes/formattingFonts.ts): headings, bold, code…; what isn't in it is in the text's font, or code's. */
  formattingFonts: FormattingFonts;
  textSize: number;
  icons: string;
  swipe: SwipeDirection;
  weekStart: WeekStart;
  calendarView: CalendarView;
  newNotes: NewNotes;
  /** The Calendar also shows notes on the day they were made or last edited, not only by their dates. */
  calendarEdited: boolean;
  feedRefresh: FeedRefresh;
  spacing: Spacing;
  /** How wide a note's text runs before wrapping, in px; or all the room there is, with the side margins kept. */
  noteWidth: number;
  fullWidth: boolean;
  /** See-through-ness and background blur of the main window and of floating notes (Mac app). */
  windowOpacity: number;
  windowBlur: boolean;
  /** What of the main window is see-through; the rest stays solid. */
  windowSeeThrough: SeeThrough;
  floatingOpacity: number;
  floatingBlur: boolean;
  /** Floating notes have the window shadow and outline (off: just the note). */
  floatingBorder: boolean;
  /** Floating notes' own theme and appearance, or "same" to match the main window. */
  floatingTheme: string;
  floatingAppearance: Appearance | "same";
  floatingButtons: WindowButtons;
  /** Floating notes also float over full-screen apps (they're on every desktop either way). */
  floatingOverFullscreen: boolean;
  paper: Paper;
  /** The paper notes are written on (lib/paper.svelte.ts): a pattern's and a texture's ids from plugins, or "none". */
  paperPattern: string;
  paperTexture: string;
  paperSpacing: PaperSpacing;
  paperSize: number;
  paperColor: PaperColor;
  /** The color of your own a pattern is drawn in, kept while another is chosen. */
  paperCustomColor: string;
  paperOpacity: number;
  /**
   * Behind the page (Settings → Plugins → Paper → Backdrop): "none", a backdrop's id from plugins, "color"
   * (backdropColor), or "image" (one of your own, kept apart: lib/paper.svelte.ts).
   */
  paperBackdrop: string;
  backdropColor: string;
  /** The page over a backdrop: the theme's background or a color of your own, and how solid it is. */
  pageColor: "theme" | "custom";
  pageCustomColor: string;
  pageOpacity: number;
  /** How a LaTeX note's PDF is made: by lines (as it draws the note), or a typesetter plugin's id ("tex"). */
  typesetter: string;
  /** The sidebar's and note list's widths, in pixels, as dragged (App.svelte), and their sides of the window. */
  sidebarWidth: number;
  listWidth: number;
  /** The note open beside another's width, as dragged. */
  sidebarSide: Side;
  listSide: Side;
  /** Open notes show as tabs above the note (tabs.svelte.ts). */
  tabs: boolean;
  /** A line beside the note for each of its headings (editor/outline.svelte.ts), on its right or left. */
  outline: boolean;
  outlineSide: Side;
  /** Scroll bars wherever something scrolls (off: none; scrolling still works). */
  scrollbars: boolean;
  /** The sidebar's version badge and GitHub button (a downloaded update's restart button shows anyway). */
  sidebarAbout: boolean;
  /** The title bars, and the sidebar's top and bottom, out of sight until the pointer or focus reaches them. */
  hideBars: boolean;
  /** Icons (off: buttons that are only an icon show its name, and the rest go, but for those that say something). */
  showIcons: boolean;
  /**
   * How Markdown shows in a note: as written and colored (source), styled with all of it in sight
   * (visible), hidden but where you're writing (live), or never seen (hidden).
   */
  markdownMode: MarkdownMode;
  /** A grip beside lines and blocks of a Markdown note that drags them somewhere else in it. */
  dragBlocks: boolean;
  /**
   * Text with `===` or `---` under it is a heading, as CommonMark reads it (Setext). Off, as lines
   * has it first, `---` there is a divider and `===` text.
   */
  underlinedHeadings: boolean;
  /** The system checks notes' spelling, and corrects it as you type (code and math never). */
  spellcheck: boolean;
  /** Text selected in a note with the pointer is copied when it's let go, as in a terminal (editor/copyOnSelect.ts). */
  copyOnSelect: boolean;
  /** A keyboard's sound as you type (sounds/typing.svelte.ts): on, which (a plugin's or a sound pack's, by id), and how loud. */
  typingSounds: boolean;
  keyboardSound: string;
  typingVolume: number;
  caretShape: (typeof CARET_SHAPES)[number];
  caretWidth: (typeof CARET_WIDTHS)[number];
  caretColor: (typeof CARET_COLORS)[number];
  caretCustomColor: string;
  caretBlink: (typeof CARET_BLINKS)[number];
  caretMotion: (typeof CARET_MOTIONS)[number];
  caretEffect: (typeof CARET_EFFECTS)[number];
  pointerStyle: (typeof POINTER_STYLES)[number];
  pointerTrail: (typeof POINTER_TRAILS)[number];
  /** A mascot keeping you company (lib/mascot/): a plugin's, by id, or "none"; how big; and whether it talks. */
  mascot: string;
  mascotSize: (typeof MASCOT_SIZES)[number];
  mascotTalks: boolean;
  /** Headings' color, and the color of your own, kept while another is chosen (themes/show.svelte.ts). */
  headingColor: HeadingColor;
  headingCustomColor: string;
  /** Notes show `->` as →, `!=` as ≠ and so on (notes/symbols.ts): in their text, and in code. */
  symbolsInText: boolean;
  symbolsInCode: boolean;
  /** Little Touches: a copy button on hovering a `Key: Value` line's value, or a property's. */
  copyValues: boolean;
  /** Little Touches: a value like `5/7` drawn as marks, five of seven filled; or as written. */
  scores: ScoreStyle;
  /** A note that's just a link is looked up and filled in, a library item (library/linkNotes.ts). */
  lookUpLinks: boolean;
  links: LinkClicks;
  /** What selecting several cells of a spreadsheet shows of them (none: nothing). */
  sheetStats: SheetStat[];
  /** How spreadsheets show dates and money (sheets/display.ts), and the currency "Format as Currency" writes. */
  sheetDates: DateStyle;
  sheetMoney: MoneyStyle;
  sheetCurrency: string;
  /** How amounts and numbers below zero show (-$5, ($5), either in red), and whether money's symbol goes at the cell's left edge. */
  sheetNegative: NegativeStyle;
  sheetMoneyEdge: boolean;
  /** Spreadsheets show their column letters and row numbers. */
  sheetHeadings: boolean;
  /** Spreadsheets' first row, and first column, stand out as headers. */
  sheetHeaderRow: boolean;
  sheetHeaderColumn: boolean;
  /** The desktop apps update themselves (updates.svelte.ts), to a version that's been out `updateWait` days. */
  autoUpdate: boolean;
  updateWait: UpdateWait;
}

export const SHEET_STATS = ["sum", "average", "min", "max", "count"] as const;
export type SheetStat = (typeof SHEET_STATS)[number];

export const OPACITY = { min: 0.3, max: 1, step: 0.01 };
/** How loud typing sounds are, 5 to 100%. */
export const TYPING_VOLUME = { min: 0.05, max: 1, step: 0.05 };
/** A paper pattern's own size, in px, when it doesn't follow the text. */
export const PAPER_SIZE = { min: 8, max: 64, step: 1 };
/** How strongly a paper pattern's lines are drawn over the page (dots, being small, a few times more). */
export const PAPER_OPACITY = { min: 0.04, max: 0.6, step: 0.01 };
/** How solid the page is over a backdrop: below 1 it shows through, blurred, never so much the text gets hard to read. */
export const PAGE_OPACITY = { min: 0.6, max: 1, step: 0.01 };

/** How many days a new version may have to be out before lines updates to it (Settings → About → Updates). */
export const UPDATE_WAITS = [0, 1, 3, 7, 14, 30] as const;
export type UpdateWait = (typeof UPDATE_WAITS)[number];

/** Where Settings opens in the desktop apps: over the notes, as on the web, or in a window of its own. */
export const SETTINGS_OPENS = ["overlay", "window"] as const;
export type SettingsOpens = (typeof SETTINGS_OPENS)[number];

/** Window opacity and blur only exist where windows can be see-through: the Mac app. */
export const windowLookAvailable = isMacApp;

/** This window is a floating note (rather than the main window). */
const isFloating = windowLabel().startsWith("note-");
/** This window is Settings (desktop apps), which keeps the usual look: never see-through. */
const isSettings = windowLabel() === "settings";

/** Letter where it's the usual paper (the Americas mostly), A4 everywhere else. */
function localPaper(): Paper {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region ?? "";
    return ["US", "CA", "MX", "PH", "CL", "CO", "VE", "GT", "CR", "PA", "DO", "PR", "SV", "NI", "HN"].includes(region) ? "letter" : "a4";
  } catch {
    return "a4";
  }
}

const KEY = "lines.prefs";
const DEFAULTS: Stored = {
  theme: "lines",
  style: "lines",
  preset: "lines",
  settingsOpens: "overlay",
  appearance: "system",
  contrast: "system",
  monochrome: false,
  invert: false,
  darkPanes: "none",
  font: "system",
  installedFont: "",
  formattingFonts: {},
  textSize: 17,
  icons: "lucide",
  swipe: "fingers",
  weekStart: "auto",
  calendarView: "week",
  newNotes: "inbox",
  calendarEdited: false,
  feedRefresh: 30,
  spacing: DEFAULT_SPACING,
  noteWidth: 720,
  fullWidth: false,
  windowOpacity: 1,
  windowBlur: true,
  windowSeeThrough: "window",
  floatingOpacity: 1,
  floatingBlur: true,
  floatingBorder: true,
  floatingTheme: "same",
  floatingAppearance: "same",
  floatingButtons: "hover",
  floatingOverFullscreen: true,
  paper: localPaper(),
  paperPattern: "none",
  paperTexture: "none",
  paperSpacing: "text",
  paperSize: 24,
  paperColor: "ink",
  paperCustomColor: "#3d7dd8",
  paperOpacity: 0.12,
  paperBackdrop: "none",
  backdropColor: "#2b2f38",
  pageColor: "theme",
  pageCustomColor: "#141414",
  pageOpacity: 1,
  typesetter: "lines",
  sidebarWidth: 230,
  listWidth: 320,
  sidebarSide: "left",
  listSide: "left",
  tabs: false,
  outline: false,
  outlineSide: "right",
  scrollbars: true,
  sidebarAbout: true,
  hideBars: false,
  showIcons: true,
  markdownMode: "live",
  dragBlocks: true,
  underlinedHeadings: false,
  spellcheck: true,
  copyOnSelect: false,
  typingSounds: false,
  keyboardSound: "creamy",
  typingVolume: 0.5,
  headingColor: "text",
  caretShape: "bar",
  caretWidth: "letter",
  caretColor: "accent",
  caretCustomColor: "#e5484d",
  caretBlink: "steps",
  caretMotion: "jump",
  caretEffect: "none",
  pointerStyle: "system",
  pointerTrail: "none",
  mascot: "none",
  mascotSize: "medium",
  mascotTalks: true,
  headingCustomColor: "#3d7dd8",
  symbolsInText: true,
  symbolsInCode: true,
  copyValues: true,
  scores: "stars",
  lookUpLinks: true,
  sheetStats: ["sum", "average", "count"],
  sheetDates: "medium",
  sheetMoney: "symbol",
  sheetCurrency: localCurrency(locale),
  sheetNegative: "minus",
  sheetMoneyEdge: false,
  sheetHeadings: true,
  sheetHeaderRow: false,
  sheetHeaderColumn: false,
  autoUpdate: true,
  updateWait: 7,
  links: {
    web: { click: "edit", modClick: "open", modShiftClick: "copy" },
    // A click on a tag shows its notes; ⌘-click puts the cursor in it, to change it.
    tag: { click: "open", modClick: "edit", modShiftClick: "open" },
    mention: { click: "edit", modClick: "open", modShiftClick: "newTab" },
  },
};

/**
 * Which saved preferences these are, to bring older ones up to date as they're read: 2, from when
 * a click on a tag opened it (before, it put the cursor in it, and ⌘-click opened it).
 */
const VERSION = 2;

/** How narrow and wide the sidebar and note list can be dragged, and where double-clicking puts them back. */
export const PANE_WIDTHS = {
  sidebar: { min: 180, max: 420, initial: DEFAULTS.sidebarWidth },
  list: { min: 240, max: 560, initial: DEFAULTS.listWidth },
};

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const oneOf = <T>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

// Blur used to be a strength (a number); anything above zero means on.
const flag = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : typeof value === "number" ? value > 0 : fallback;

const APPEARANCES: Appearance[] = ["system", "light", "dark"];
const SIDES: Side[] = ["left", "right"];

/** Each kind of link's action for each click, where it's one that kind can do. */
function readLinks(raw: unknown, version: number): LinkClicks {
  const stored = { ...((raw ?? {}) as Record<string, Record<string, unknown> | undefined>) };
  // Saved before a click opened a tag, and still as they were then: as they are now, with the rest.
  const { tag } = stored;
  if (version < 2 && tag?.click === "edit" && tag.modClick === "open" && tag.modShiftClick === "open") delete stored.tag;
  return Object.fromEntries(
    (Object.keys(LINK_ACTIONS) as LinkKind[]).map((kind) => [
      kind,
      Object.fromEntries(LINK_CLICKS.map((click) => [click, oneOf(stored[kind]?.[click], LINK_ACTIONS[kind], DEFAULTS.links[kind][click])])),
    ]),
  ) as LinkClicks;
}

/** A plugin's theme, icon set, typesetter or font, by id. */
const id = (value: unknown, fallback: string) => (typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value) ? value : fallback);
/** A CSS color, short enough to be one someone chose rather than anything else. */
const color = (value: unknown, fallback: string) => (typeof value === "string" && value.length <= 120 && CSS.supports("color", value) ? value : fallback);

/** The saved preferences (or those `json` gives), each checked and falling back to its default; unknown keys are dropped. */
function read(json?: string): Stored {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(json ?? localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    // Unreadable: start from the defaults.
  }
  const spacing = (raw.spacing ?? {}) as Record<string, unknown>;
  return {
    theme: id(raw.theme, DEFAULTS.theme),
    style: id(raw.style, DEFAULTS.style),
    // Before presets, the style chosen was the preset of it.
    preset: id(raw.preset, id(raw.style, DEFAULTS.preset)),
    settingsOpens: oneOf(raw.settingsOpens, SETTINGS_OPENS, DEFAULTS.settingsOpens),
    appearance: oneOf(raw.appearance, APPEARANCES, DEFAULTS.appearance),
    contrast: oneOf(raw.contrast, ["system", "standard", "more"] as const, DEFAULTS.contrast),
    monochrome: flag(raw.monochrome, DEFAULTS.monochrome),
    invert: flag(raw.invert, DEFAULTS.invert),
    darkPanes: oneOf(raw.darkPanes, DARK_PANES, DEFAULTS.darkPanes),
    font: id(raw.font, DEFAULTS.font),
    installedFont: familyName(raw.installedFont),
    formattingFonts: readFormattingFonts(raw.formattingFonts),
    textSize: clamp(raw.textSize, TEXT_SIZE.min, TEXT_SIZE.max, DEFAULTS.textSize),
    icons: id(raw.icons, DEFAULTS.icons),
    swipe: oneOf(raw.swipe, ["fingers", "reversed"] as const, DEFAULTS.swipe),
    weekStart: oneOf(raw.weekStart, WEEK_STARTS, DEFAULTS.weekStart),
    calendarView: oneOf(raw.calendarView, CALENDAR_VIEWS, DEFAULTS.calendarView),
    newNotes: oneOf(raw.newNotes, NEW_NOTES, DEFAULTS.newNotes),
    calendarEdited: flag(raw.calendarEdited, DEFAULTS.calendarEdited),
    feedRefresh: oneOf(raw.feedRefresh, FEED_REFRESH, DEFAULTS.feedRefresh),
    spacing: Object.fromEntries(
      SPACING_FIELDS.map(({ key, min, max }) => [key, clamp(spacing[key], min, max, DEFAULT_SPACING[key])]),
    ) as unknown as Spacing,
    // Kept with the spacing until Note width had a section of its own.
    noteWidth: clamp(raw.noteWidth ?? spacing.width, NOTE_WIDTH.min, NOTE_WIDTH.max, DEFAULTS.noteWidth),
    fullWidth: flag(raw.fullWidth, DEFAULTS.fullWidth),
    windowOpacity: clamp(raw.windowOpacity, OPACITY.min, OPACITY.max, 1),
    windowBlur: flag(raw.windowBlur, true),
    windowSeeThrough: oneOf(raw.windowSeeThrough, SEE_THROUGH, DEFAULTS.windowSeeThrough),
    floatingOpacity: clamp(raw.floatingOpacity, OPACITY.min, OPACITY.max, 1),
    floatingBlur: flag(raw.floatingBlur, true),
    floatingBorder: flag(raw.floatingBorder, true),
    floatingTheme: id(raw.floatingTheme, DEFAULTS.floatingTheme),
    floatingAppearance: oneOf(raw.floatingAppearance, [...APPEARANCES, "same"] as const, "same"),
    floatingButtons: oneOf(raw.floatingButtons, ["hover", "always"] as const, DEFAULTS.floatingButtons),
    floatingOverFullscreen: flag(raw.floatingOverFullscreen, true),
    paper: oneOf(raw.paper, ["a4", "letter"] as const, DEFAULTS.paper),
    paperPattern: id(raw.paperPattern, DEFAULTS.paperPattern),
    paperTexture: id(raw.paperTexture, DEFAULTS.paperTexture),
    paperSpacing: oneOf(raw.paperSpacing, ["text", "custom"] as const, DEFAULTS.paperSpacing),
    paperSize: clamp(raw.paperSize, PAPER_SIZE.min, PAPER_SIZE.max, DEFAULTS.paperSize),
    paperColor: oneOf(raw.paperColor, ["ink", "accent", "custom"] as const, DEFAULTS.paperColor),
    paperCustomColor: color(raw.paperCustomColor, DEFAULTS.paperCustomColor),
    paperOpacity: clamp(raw.paperOpacity, PAPER_OPACITY.min, PAPER_OPACITY.max, DEFAULTS.paperOpacity),
    paperBackdrop: id(raw.paperBackdrop, DEFAULTS.paperBackdrop),
    backdropColor: color(raw.backdropColor, DEFAULTS.backdropColor),
    pageColor: oneOf(raw.pageColor, ["theme", "custom"] as const, DEFAULTS.pageColor),
    pageCustomColor: color(raw.pageCustomColor, DEFAULTS.pageCustomColor),
    pageOpacity: clamp(raw.pageOpacity, PAGE_OPACITY.min, PAGE_OPACITY.max, DEFAULTS.pageOpacity),
    typesetter: id(raw.typesetter, DEFAULTS.typesetter),
    sidebarWidth: clamp(raw.sidebarWidth, PANE_WIDTHS.sidebar.min, PANE_WIDTHS.sidebar.max, DEFAULTS.sidebarWidth),
    listWidth: clamp(raw.listWidth, PANE_WIDTHS.list.min, PANE_WIDTHS.list.max, DEFAULTS.listWidth),
    sidebarSide: oneOf(raw.sidebarSide, SIDES, DEFAULTS.sidebarSide),
    listSide: oneOf(raw.listSide, SIDES, DEFAULTS.listSide),
    tabs: flag(raw.tabs, DEFAULTS.tabs),
    outline: flag(raw.outline, DEFAULTS.outline),
    outlineSide: oneOf(raw.outlineSide, SIDES, DEFAULTS.outlineSide),
    scrollbars: flag(raw.scrollbars, DEFAULTS.scrollbars),
    sidebarAbout: flag(raw.sidebarAbout, DEFAULTS.sidebarAbout),
    hideBars: flag(raw.hideBars, DEFAULTS.hideBars),
    showIcons: flag(raw.showIcons, DEFAULTS.showIcons),
    markdownMode: oneOf(raw.markdownMode, MARKDOWN_MODES, DEFAULTS.markdownMode),
    dragBlocks: flag(raw.dragBlocks, DEFAULTS.dragBlocks),
    underlinedHeadings: flag(raw.underlinedHeadings, DEFAULTS.underlinedHeadings),
    spellcheck: flag(raw.spellcheck, DEFAULTS.spellcheck),
    copyOnSelect: flag(raw.copyOnSelect, DEFAULTS.copyOnSelect),
    typingSounds: flag(raw.typingSounds, DEFAULTS.typingSounds),
    keyboardSound: id(raw.keyboardSound, DEFAULTS.keyboardSound),
    typingVolume: clamp(raw.typingVolume, TYPING_VOLUME.min, TYPING_VOLUME.max, DEFAULTS.typingVolume),
    headingColor: oneOf(raw.headingColor, HEADING_COLORS, DEFAULTS.headingColor),
    caretShape: oneOf(raw.caretShape, CARET_SHAPES, DEFAULTS.caretShape),
    caretWidth: oneOf(raw.caretWidth, CARET_WIDTHS, DEFAULTS.caretWidth),
    caretColor: oneOf(raw.caretColor, CARET_COLORS, DEFAULTS.caretColor),
    caretCustomColor: color(raw.caretCustomColor, DEFAULTS.caretCustomColor),
    caretBlink: oneOf(raw.caretBlink, CARET_BLINKS, DEFAULTS.caretBlink),
    caretMotion: oneOf(raw.caretMotion, CARET_MOTIONS, DEFAULTS.caretMotion),
    caretEffect: oneOf(raw.caretEffect, CARET_EFFECTS, DEFAULTS.caretEffect),
    pointerStyle: oneOf(raw.pointerStyle, POINTER_STYLES, DEFAULTS.pointerStyle),
    pointerTrail: oneOf(raw.pointerTrail, POINTER_TRAILS, DEFAULTS.pointerTrail),
    mascot: id(raw.mascot, DEFAULTS.mascot),
    mascotSize: oneOf(raw.mascotSize, MASCOT_SIZES, DEFAULTS.mascotSize),
    mascotTalks: flag(raw.mascotTalks, DEFAULTS.mascotTalks),
    headingCustomColor: color(raw.headingCustomColor, DEFAULTS.headingCustomColor),
    symbolsInText: flag(raw.symbolsInText, DEFAULTS.symbolsInText),
    symbolsInCode: flag(raw.symbolsInCode, DEFAULTS.symbolsInCode),
    copyValues: flag(raw.copyValues, DEFAULTS.copyValues),
    scores: oneOf(raw.scores, SCORE_STYLES, DEFAULTS.scores),
    lookUpLinks: flag(raw.lookUpLinks, DEFAULTS.lookUpLinks),
    links: readLinks(raw.links, typeof raw.version === "number" ? raw.version : 1),
    sheetStats: Array.isArray(raw.sheetStats) ? SHEET_STATS.filter((stat) => (raw.sheetStats as unknown[]).includes(stat)) : DEFAULTS.sheetStats,
    sheetDates: oneOf(raw.sheetDates, DATE_STYLES, DEFAULTS.sheetDates),
    sheetMoney: oneOf(raw.sheetMoney, MONEY_STYLES, DEFAULTS.sheetMoney),
    sheetCurrency: oneOf(raw.sheetCurrency, CURRENCIES, DEFAULTS.sheetCurrency),
    sheetNegative: oneOf(raw.sheetNegative, NEGATIVE_STYLES, DEFAULTS.sheetNegative),
    sheetMoneyEdge: flag(raw.sheetMoneyEdge, DEFAULTS.sheetMoneyEdge),
    sheetHeadings: flag(raw.sheetHeadings, DEFAULTS.sheetHeadings),
    sheetHeaderRow: flag(raw.sheetHeaderRow, DEFAULTS.sheetHeaderRow),
    sheetHeaderColumn: flag(raw.sheetHeaderColumn, DEFAULTS.sheetHeaderColumn),
    autoUpdate: flag(raw.autoUpdate, DEFAULTS.autoUpdate),
    updateWait: oneOf(raw.updateWait, UPDATE_WAITS, DEFAULTS.updateWait),
  };
}

/** Settings as stored ones are read: each checked, and those missing or wrong lines' own. */
export const readSettings = (raw: Record<string, unknown>): Stored => read(JSON.stringify({ version: VERSION, ...raw }));

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const contrastQuery = window.matchMedia("(prefers-contrast: more)");

class Prefs {
  #initial = read();
  theme = $state(this.#initial.theme);
  style = $state(this.#initial.style);
  preset = $state(this.#initial.preset);
  settingsOpens = $state<SettingsOpens>(this.#initial.settingsOpens);
  appearance = $state<Appearance>(this.#initial.appearance);
  contrast = $state<Contrast>(this.#initial.contrast);
  monochrome = $state(this.#initial.monochrome);
  invert = $state(this.#initial.invert);
  darkPanes = $state<DarkPanes>(this.#initial.darkPanes);
  font = $state<FontId>(this.#initial.font);
  installedFont = $state(this.#initial.installedFont);
  formattingFonts = $state(this.#initial.formattingFonts);
  textSize = $state(this.#initial.textSize);
  icons = $state(this.#initial.icons);
  swipe = $state<SwipeDirection>(this.#initial.swipe);
  weekStart = $state<WeekStart>(this.#initial.weekStart);
  calendarView = $state<CalendarView>(this.#initial.calendarView);
  newNotes = $state<NewNotes>(this.#initial.newNotes);
  calendarEdited = $state(this.#initial.calendarEdited);
  feedRefresh = $state<FeedRefresh>(this.#initial.feedRefresh);
  windowOpacity = $state(this.#initial.windowOpacity);
  windowBlur = $state(this.#initial.windowBlur);
  windowSeeThrough = $state(this.#initial.windowSeeThrough);
  floatingOpacity = $state(this.#initial.floatingOpacity);
  floatingBlur = $state(this.#initial.floatingBlur);
  floatingBorder = $state(this.#initial.floatingBorder);
  floatingTheme = $state(this.#initial.floatingTheme);
  floatingAppearance = $state<Appearance | "same">(this.#initial.floatingAppearance);
  floatingButtons = $state<WindowButtons>(this.#initial.floatingButtons);
  floatingOverFullscreen = $state(this.#initial.floatingOverFullscreen);
  paper = $state<Paper>(this.#initial.paper);
  paperPattern = $state(this.#initial.paperPattern);
  paperTexture = $state(this.#initial.paperTexture);
  paperSpacing = $state<PaperSpacing>(this.#initial.paperSpacing);
  paperSize = $state(this.#initial.paperSize);
  paperColor = $state<PaperColor>(this.#initial.paperColor);
  paperCustomColor = $state(this.#initial.paperCustomColor);
  paperOpacity = $state(this.#initial.paperOpacity);
  paperBackdrop = $state(this.#initial.paperBackdrop);
  backdropColor = $state(this.#initial.backdropColor);
  pageColor = $state<"theme" | "custom">(this.#initial.pageColor);
  pageCustomColor = $state(this.#initial.pageCustomColor);
  pageOpacity = $state(this.#initial.pageOpacity);
  typesetter = $state(this.#initial.typesetter);
  sidebarWidth = $state(this.#initial.sidebarWidth);
  listWidth = $state(this.#initial.listWidth);
  sidebarSide = $state(this.#initial.sidebarSide);
  listSide = $state(this.#initial.listSide);
  tabs = $state(this.#initial.tabs);
  outline = $state(this.#initial.outline);
  outlineSide = $state(this.#initial.outlineSide);
  scrollbars = $state(this.#initial.scrollbars);
  sidebarAbout = $state(this.#initial.sidebarAbout);
  hideBars = $state(this.#initial.hideBars);
  showIcons = $state(this.#initial.showIcons);
  markdownMode = $state(this.#initial.markdownMode);
  dragBlocks = $state(this.#initial.dragBlocks);
  underlinedHeadings = $state(this.#initial.underlinedHeadings);
  spellcheck = $state(this.#initial.spellcheck);
  copyOnSelect = $state(this.#initial.copyOnSelect);
  typingSounds = $state(this.#initial.typingSounds);
  keyboardSound = $state(this.#initial.keyboardSound);
  typingVolume = $state(this.#initial.typingVolume);
  headingColor = $state(this.#initial.headingColor);
  caretShape = $state(this.#initial.caretShape);
  caretWidth = $state(this.#initial.caretWidth);
  caretColor = $state(this.#initial.caretColor);
  caretCustomColor = $state(this.#initial.caretCustomColor);
  caretBlink = $state(this.#initial.caretBlink);
  caretMotion = $state(this.#initial.caretMotion);
  caretEffect = $state(this.#initial.caretEffect);
  pointerStyle = $state(this.#initial.pointerStyle);
  pointerTrail = $state(this.#initial.pointerTrail);
  mascot = $state(this.#initial.mascot);
  mascotSize = $state(this.#initial.mascotSize);
  mascotTalks = $state(this.#initial.mascotTalks);
  headingCustomColor = $state(this.#initial.headingCustomColor);
  symbolsInText = $state(this.#initial.symbolsInText);
  symbolsInCode = $state(this.#initial.symbolsInCode);
  copyValues = $state(this.#initial.copyValues);
  scores = $state(this.#initial.scores);
  lookUpLinks = $state(this.#initial.lookUpLinks);
  sheetStats = $state(this.#initial.sheetStats);
  sheetDates = $state(this.#initial.sheetDates);
  sheetMoney = $state(this.#initial.sheetMoney);
  sheetCurrency = $state(this.#initial.sheetCurrency);
  sheetNegative = $state(this.#initial.sheetNegative);
  sheetMoneyEdge = $state(this.#initial.sheetMoneyEdge);
  sheetHeadings = $state(this.#initial.sheetHeadings);
  sheetHeaderRow = $state(this.#initial.sheetHeaderRow);
  sheetHeaderColumn = $state(this.#initial.sheetHeaderColumn);
  autoUpdate = $state(this.#initial.autoUpdate);
  updateWait = $state(this.#initial.updateWait);
  /** Settings → Editor → Links: what a click, ⌘-click and ⌘⇧-click on each kind of link does. */
  links = $state(this.#initial.links);
  #markWindowReady!: () => void;
  /** Resolves once this window's native look (opaque or see-through) has first been applied. */
  readonly windowReady = new Promise<void>((resolve) => (this.#markWindowReady = resolve));

  /** What we last wrote (or took up from another window), so a change only goes out to other windows once. */
  #saved = JSON.stringify(this.#initial);
  spacing = $state<Spacing>(this.#initial.spacing);
  noteWidth = $state(this.#initial.noteWidth);
  fullWidth = $state(this.#initial.fullWidth);

  #systemDark = $state(darkQuery.matches);
  #systemMoreContrast = $state(contrastQuery.matches);
  /** Whether text and borders are darkened for contrast, by choice or because the device asks for it. */
  readonly moreContrast = $derived(this.contrast === "more" || (this.contrast === "system" && this.#systemMoreContrast));
  readonly dark = $derived(this.#isDark(this.appearance));
  /** Floating notes' look, which can differ from the main window's. */
  readonly floatingLook = $derived({
    theme: this.floatingTheme === "same" ? this.theme : this.floatingTheme,
    dark: this.floatingAppearance === "same" ? this.dark : this.#isDark(this.floatingAppearance),
  });
  /** This window's theme (by id; themes/show.svelte.ts shows it) and whether it's dark: a floating note can have its own. */
  readonly windowLook = $derived(isFloating ? this.floatingLook : { theme: this.theme, dark: this.dark });

  // This window's native look; the effect below re-runs only when one of these flips.
  readonly #translucent = $derived((isFloating ? this.floatingOpacity : this.windowOpacity) < 1);
  readonly #blur = $derived(isFloating ? this.floatingBlur : this.windowBlur);
  readonly #shadow = $derived(isFloating ? this.floatingBorder : true);

  #isDark(appearance: Appearance) {
    return appearance === "system" ? this.#systemDark : appearance === "dark";
  }

  constructor() {
    darkQuery.addEventListener("change", (event) => (this.#systemDark = event.matches));
    contrastQuery.addEventListener("change", (event) => (this.#systemMoreContrast = event.matches));
    if (!windowLookAvailable || isSettings) this.#markWindowReady();
    // Apply before the first paint so there's no flash of the default theme.
    this.#apply();
    $effect.root(() => {
      $effect(() => this.#apply());
      // Saved, and sent to the other windows, as it changes: they show it at once, a slider's
      // every step too.
      $effect(() => {
        const json = this.#serialize();
        if (json !== this.#saved) this.#save(json);
      });
      // Below 100% opacity the window turns see-through, with the desktop blurred behind it;
      // at 100% it stays a normal Mac window (with the system's rounded corners and border).
      $effect(() => {
        if (!windowLookAvailable || isSettings) return;
        const look = { translucent: this.#translucent, blur: this.#blur, shadow: this.#shadow };
        void import("@tauri-apps/api/core")
          .then(({ invoke }) => invoke("set_window_effects", look))
          .catch((error) => console.error("lines: couldn't set the window's look", error))
          .finally(() => this.#markWindowReady());
      });
    });
    // Another window (Settings, main or floating) changed a setting: take it up, from the message
    // rather than storage, which WebKit brings up to date in other windows only a moment later.
    void onAnnounce((message) => message.type === "prefs" && this.#reload(message.prefs));
  }

  /** Makes notes' text a step bigger (1) or smaller (-1), or its usual size (0), within its range; returns the new size. */
  stepTextSize(by: -1 | 0 | 1) {
    const next = by === 0 ? DEFAULTS.textSize : this.textSize + by * TEXT_SIZE.step;
    this.textSize = Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, next));
    return this.textSize;
  }

  /**
   * Reads every preference that changes line heights, so an effect calling it
   * re-runs when they change and can tell CodeMirror to measure again.
   */
  watchLayout() {
    return [this.font, this.installedFont, $state.snapshot(this.formattingFonts), this.textSize, $state.snapshot(this.spacing)];
  }

  #apply() {
    const root = document.documentElement;
    root.dataset.font = this.installedFont ? "installed" : this.font;
    root.toggleAttribute("data-no-scrollbars", !this.scrollbars);
    root.toggleAttribute("data-hide-bars", this.hideBars);
    root.toggleAttribute("data-no-icons", !this.showIcons);
    const { style } = root;
    if (this.installedFont) style.setProperty("--font-text", installedFamily(this.installedFont));
    else style.removeProperty("--font-text");
    style.setProperty("--editor-size", `${this.textSize}px`);
    const s = this.spacing;
    style.setProperty("--editor-line-height", String(s.lineHeight));
    style.setProperty("--paragraph-gap", String(s.paragraph));
    style.setProperty("--heading-space", String(s.headings));
    style.setProperty("--title-gap", `${s.title}px`);
    style.setProperty("--editor-width", this.fullWidth ? "none" : `${this.noteWidth}px`);
    style.setProperty("--editor-margin", `${s.margin}px`);
    style.setProperty("--editor-pad-top", `${s.top}px`);
    const opacity = windowLookAvailable && !isSettings ? (isFloating ? this.floatingOpacity : this.windowOpacity) : 1;
    style.setProperty("--window-alpha", `${Math.round(opacity * 100)}%`);
    if (opacity < 1) root.dataset.translucent = "";
    else delete root.dataset.translucent;
    // In the main window, maybe only its sidebar, or its sidebar and note list (app.css).
    if (opacity < 1 && !isFloating && this.windowSeeThrough !== "window") root.dataset.seeThrough = this.windowSeeThrough;
    else delete root.dataset.seeThrough;
    // The light inner edge belongs with the window's outline; without a border, neither.
    if (isFloating && !this.floatingBorder) root.dataset.borderless = "";
    else delete root.dataset.borderless;
  }

  #serialize() {
    const stored: Stored = {
      theme: this.theme,
      style: this.style,
      preset: this.preset,
      settingsOpens: this.settingsOpens,
      appearance: this.appearance,
      contrast: this.contrast,
      monochrome: this.monochrome,
      invert: this.invert,
      darkPanes: this.darkPanes,
      font: this.font,
      installedFont: this.installedFont,
      formattingFonts: $state.snapshot(this.formattingFonts),
      textSize: this.textSize,
      icons: this.icons,
      swipe: this.swipe,
      weekStart: this.weekStart,
      calendarView: this.calendarView,
      newNotes: this.newNotes,
      calendarEdited: this.calendarEdited,
      feedRefresh: this.feedRefresh,
      spacing: $state.snapshot(this.spacing),
      noteWidth: this.noteWidth,
      fullWidth: this.fullWidth,
      windowOpacity: this.windowOpacity,
      windowBlur: this.windowBlur,
      windowSeeThrough: this.windowSeeThrough,
      floatingOpacity: this.floatingOpacity,
      floatingBlur: this.floatingBlur,
      floatingBorder: this.floatingBorder,
      floatingTheme: this.floatingTheme,
      floatingAppearance: this.floatingAppearance,
      floatingButtons: this.floatingButtons,
      floatingOverFullscreen: this.floatingOverFullscreen,
      paper: this.paper,
      paperPattern: this.paperPattern,
      paperTexture: this.paperTexture,
      paperSpacing: this.paperSpacing,
      paperSize: this.paperSize,
      paperColor: this.paperColor,
      paperCustomColor: this.paperCustomColor,
      paperOpacity: this.paperOpacity,
      paperBackdrop: this.paperBackdrop,
      backdropColor: this.backdropColor,
      pageColor: this.pageColor,
      pageCustomColor: this.pageCustomColor,
      pageOpacity: this.pageOpacity,
      typesetter: this.typesetter,
      sidebarWidth: this.sidebarWidth,
      listWidth: this.listWidth,
      sidebarSide: this.sidebarSide,
      listSide: this.listSide,
      tabs: this.tabs,
      outline: this.outline,
      outlineSide: this.outlineSide,
      scrollbars: this.scrollbars,
      sidebarAbout: this.sidebarAbout,
      hideBars: this.hideBars,
      showIcons: this.showIcons,
      markdownMode: this.markdownMode,
      dragBlocks: this.dragBlocks,
      underlinedHeadings: this.underlinedHeadings,
      spellcheck: this.spellcheck,
      copyOnSelect: this.copyOnSelect,
      typingSounds: this.typingSounds,
      keyboardSound: this.keyboardSound,
      typingVolume: this.typingVolume,
      headingColor: this.headingColor,
      caretShape: this.caretShape,
      caretWidth: this.caretWidth,
      caretColor: this.caretColor,
      caretCustomColor: this.caretCustomColor,
      caretBlink: this.caretBlink,
      caretMotion: this.caretMotion,
      caretEffect: this.caretEffect,
      pointerStyle: this.pointerStyle,
      pointerTrail: this.pointerTrail,
      mascot: this.mascot,
      mascotSize: this.mascotSize,
      mascotTalks: this.mascotTalks,
      headingCustomColor: this.headingCustomColor,
      symbolsInText: this.symbolsInText,
      symbolsInCode: this.symbolsInCode,
      copyValues: this.copyValues,
      scores: this.scores,
      lookUpLinks: this.lookUpLinks,
      links: $state.snapshot(this.links),
      sheetStats: $state.snapshot(this.sheetStats),
      sheetDates: this.sheetDates,
      sheetMoney: this.sheetMoney,
      sheetCurrency: this.sheetCurrency,
      sheetNegative: this.sheetNegative,
      sheetMoneyEdge: this.sheetMoneyEdge,
      sheetHeadings: this.sheetHeadings,
      sheetHeaderRow: this.sheetHeaderRow,
      sheetHeaderColumn: this.sheetHeaderColumn,
      autoUpdate: this.autoUpdate,
      updateWait: this.updateWait,
    };
    return JSON.stringify({ version: VERSION, ...stored });
  }

  #save(json: string) {
    this.#saved = json;
    try {
      localStorage.setItem(KEY, json);
    } catch {
      // Private mode or full storage: preferences just won't persist.
    }
    void announce({ type: "prefs", prefs: json });
  }

  #reload(json: string) {
    const next = read(json);
    this.theme = next.theme;
    this.style = next.style;
    this.preset = next.preset;
    this.settingsOpens = next.settingsOpens;
    this.appearance = next.appearance;
    this.contrast = next.contrast;
    this.monochrome = next.monochrome;
    this.invert = next.invert;
    this.darkPanes = next.darkPanes;
    this.font = next.font;
    this.installedFont = next.installedFont;
    if (!sameFormattingFonts(this.formattingFonts, next.formattingFonts)) this.formattingFonts = next.formattingFonts;
    this.textSize = next.textSize;
    this.icons = next.icons;
    this.swipe = next.swipe;
    this.weekStart = next.weekStart;
    this.calendarView = next.calendarView;
    this.newNotes = next.newNotes;
    this.calendarEdited = next.calendarEdited;
    this.feedRefresh = next.feedRefresh;
    if (!sameSpacing(this.spacing, next.spacing)) this.spacing = next.spacing;
    this.noteWidth = next.noteWidth;
    this.fullWidth = next.fullWidth;
    this.windowOpacity = next.windowOpacity;
    this.windowBlur = next.windowBlur;
    this.windowSeeThrough = next.windowSeeThrough;
    this.floatingOpacity = next.floatingOpacity;
    this.floatingBlur = next.floatingBlur;
    this.floatingBorder = next.floatingBorder;
    this.floatingTheme = next.floatingTheme;
    this.floatingAppearance = next.floatingAppearance;
    this.floatingButtons = next.floatingButtons;
    this.floatingOverFullscreen = next.floatingOverFullscreen;
    this.paper = next.paper;
    this.paperPattern = next.paperPattern;
    this.paperTexture = next.paperTexture;
    this.paperSpacing = next.paperSpacing;
    this.paperSize = next.paperSize;
    this.paperColor = next.paperColor;
    this.paperCustomColor = next.paperCustomColor;
    this.paperOpacity = next.paperOpacity;
    this.paperBackdrop = next.paperBackdrop;
    this.backdropColor = next.backdropColor;
    this.pageColor = next.pageColor;
    this.pageCustomColor = next.pageCustomColor;
    this.pageOpacity = next.pageOpacity;
    this.typesetter = next.typesetter;
    this.sidebarWidth = next.sidebarWidth;
    this.listWidth = next.listWidth;
    this.sidebarSide = next.sidebarSide;
    this.listSide = next.listSide;
    this.tabs = next.tabs;
    this.outline = next.outline;
    this.outlineSide = next.outlineSide;
    this.scrollbars = next.scrollbars;
    this.sidebarAbout = next.sidebarAbout;
    this.hideBars = next.hideBars;
    this.showIcons = next.showIcons;
    this.markdownMode = next.markdownMode;
    this.dragBlocks = next.dragBlocks;
    this.underlinedHeadings = next.underlinedHeadings;
    this.spellcheck = next.spellcheck;
    this.copyOnSelect = next.copyOnSelect;
    this.typingSounds = next.typingSounds;
    this.keyboardSound = next.keyboardSound;
    this.typingVolume = next.typingVolume;
    this.headingColor = next.headingColor;
    this.caretShape = next.caretShape;
    this.caretColor = next.caretColor;
    this.caretCustomColor = next.caretCustomColor;
    this.caretBlink = next.caretBlink;
    this.caretMotion = next.caretMotion;
    this.caretEffect = next.caretEffect;
    this.pointerStyle = next.pointerStyle;
    this.pointerTrail = next.pointerTrail;
    this.mascot = next.mascot;
    this.mascotSize = next.mascotSize;
    this.mascotTalks = next.mascotTalks;
    this.headingCustomColor = next.headingCustomColor;
    this.symbolsInText = next.symbolsInText;
    this.symbolsInCode = next.symbolsInCode;
    this.copyValues = next.copyValues;
    this.scores = next.scores;
    this.lookUpLinks = next.lookUpLinks;
    if (next.sheetStats.join() !== this.sheetStats.join()) this.sheetStats = next.sheetStats;
    this.sheetDates = next.sheetDates;
    this.sheetMoney = next.sheetMoney;
    this.sheetCurrency = next.sheetCurrency;
    this.sheetNegative = next.sheetNegative;
    this.sheetMoneyEdge = next.sheetMoneyEdge;
    this.sheetHeadings = next.sheetHeadings;
    this.sheetHeaderRow = next.sheetHeaderRow;
    this.sheetHeaderColumn = next.sheetHeaderColumn;
    this.autoUpdate = next.autoUpdate;
    this.updateWait = next.updateWait;
    if (JSON.stringify(this.links) !== JSON.stringify(next.links)) this.links = next.links;
    // As already saved, so taking it up here doesn't send it back out.
    this.#saved = this.#serialize();
  }
}

export const prefs = new Prefs();
