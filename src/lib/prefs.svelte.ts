import { locale, t } from "./i18n/index.svelte";
import { isMacApp } from "./platform";
import { CURRENCIES, DATE_STYLES, type DateStyle, localCurrency, MONEY_STYLES, type MoneyStyle, NEGATIVE_STYLES, type NegativeStyle } from "./sheets/display";
import { announce, onAnnounce, windowLabel } from "./windows/channel";

export type Appearance = "system" | "light" | "dark";
/** Standard colors, or text and borders darkened for contrast (each theme's `moreContrast`); "system" follows the device's Increase Contrast. */
export type Contrast = "system" | "standard" | "more";
export type FontId = "system" | "serif" | "rounded" | "mono";
/** Whether a floating note shows its close/minimize/zoom buttons all the time, or on hover. */
export type WindowButtons = "hover" | "always";
/** Which way a note moves when swiped with two fingers on a trackpad. */
export type SwipeDirection = "fingers" | "reversed";
/** The paper a note's PDF is laid out on. */
export type Paper = "a4" | "letter";
/** Which side of the window a pane goes on. */
export type Side = "left" | "right";

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
interface Stored {
  theme: string;
  appearance: Appearance;
  contrast: Contrast;
  font: FontId;
  textSize: number;
  icons: string;
  swipe: SwipeDirection;
  spacing: Spacing;
  /** How wide a note's text runs before wrapping, in px; or all the room there is, with the side margins kept. */
  noteWidth: number;
  fullWidth: boolean;
  /** See-through-ness and background blur of the main window and of floating notes (Mac app). */
  windowOpacity: number;
  windowBlur: boolean;
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
  /** How a LaTeX note's PDF is made: by lines (as it draws the note), or a typesetter plugin's id ("tex"). */
  typesetter: string;
  /** The sidebar's and note list's widths, in pixels, as dragged (App.svelte), and their sides of the window. */
  sidebarWidth: number;
  listWidth: number;
  /** The note open beside another's width, as dragged. */
  sideWidth: number;
  sidebarSide: Side;
  listSide: Side;
  /** Open notes show as tabs above the note (tabs.svelte.ts). */
  tabs: boolean;
  /** A line beside the note for each of its headings (editor/outline.svelte.ts), on its right or left. */
  outline: boolean;
  outlineSide: Side;
  /** Notes show `->` as →, `!=` as ≠ and so on (notes/symbols.ts): in their text, and in code. */
  symbolsInText: boolean;
  symbolsInCode: boolean;
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
}

export const SHEET_STATS = ["sum", "average", "min", "max", "count"] as const;
export type SheetStat = (typeof SHEET_STATS)[number];

export const OPACITY = { min: 0.3, max: 1, step: 0.01 };

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
  appearance: "system",
  contrast: "system",
  font: "system",
  textSize: 17,
  icons: "lucide",
  swipe: "fingers",
  spacing: DEFAULT_SPACING,
  noteWidth: 720,
  fullWidth: false,
  windowOpacity: 1,
  windowBlur: true,
  floatingOpacity: 1,
  floatingBlur: true,
  floatingBorder: true,
  floatingTheme: "same",
  floatingAppearance: "same",
  floatingButtons: "hover",
  floatingOverFullscreen: true,
  paper: localPaper(),
  typesetter: "lines",
  sidebarWidth: 230,
  listWidth: 320,
  sideWidth: 520,
  sidebarSide: "left",
  listSide: "left",
  tabs: false,
  outline: false,
  outlineSide: "right",
  symbolsInText: true,
  symbolsInCode: true,
  sheetStats: ["sum", "average", "count"],
  sheetDates: "medium",
  sheetMoney: "symbol",
  sheetCurrency: localCurrency(locale),
  sheetNegative: "minus",
  sheetMoneyEdge: false,
  sheetHeadings: true,
  sheetHeaderRow: false,
  sheetHeaderColumn: false,
  links: {
    web: { click: "edit", modClick: "open", modShiftClick: "copy" },
    tag: { click: "edit", modClick: "open", modShiftClick: "open" },
    mention: { click: "edit", modClick: "open", modShiftClick: "newTab" },
  },
};

/** How narrow and wide the sidebar and note list can be dragged, and where double-clicking puts them back. */
export const PANE_WIDTHS = {
  sidebar: { min: 180, max: 420, initial: DEFAULTS.sidebarWidth },
  list: { min: 240, max: 560, initial: DEFAULTS.listWidth },
  side: { min: 300, max: 1400, initial: DEFAULTS.sideWidth },
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
function readLinks(raw: unknown): LinkClicks {
  const stored = (raw ?? {}) as Record<string, Record<string, unknown> | undefined>;
  return Object.fromEntries(
    (Object.keys(LINK_ACTIONS) as LinkKind[]).map((kind) => [
      kind,
      Object.fromEntries(LINK_CLICKS.map((click) => [click, oneOf(stored[kind]?.[click], LINK_ACTIONS[kind], DEFAULTS.links[kind][click])])),
    ]),
  ) as LinkClicks;
}

/** A plugin's theme, icon set or typesetter, by id. */
const id = (value: unknown, fallback: string) => (typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value) ? value : fallback);

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
    appearance: oneOf(raw.appearance, APPEARANCES, DEFAULTS.appearance),
    contrast: oneOf(raw.contrast, ["system", "standard", "more"] as const, DEFAULTS.contrast),
    font: oneOf(raw.font, FONTS.map((f) => f.id), DEFAULTS.font),
    textSize: clamp(raw.textSize, TEXT_SIZE.min, TEXT_SIZE.max, DEFAULTS.textSize),
    icons: id(raw.icons, DEFAULTS.icons),
    swipe: oneOf(raw.swipe, ["fingers", "reversed"] as const, DEFAULTS.swipe),
    spacing: Object.fromEntries(
      SPACING_FIELDS.map(({ key, min, max }) => [key, clamp(spacing[key], min, max, DEFAULT_SPACING[key])]),
    ) as unknown as Spacing,
    // Kept with the spacing until Note width had a section of its own.
    noteWidth: clamp(raw.noteWidth ?? spacing.width, NOTE_WIDTH.min, NOTE_WIDTH.max, DEFAULTS.noteWidth),
    fullWidth: flag(raw.fullWidth, DEFAULTS.fullWidth),
    windowOpacity: clamp(raw.windowOpacity, OPACITY.min, OPACITY.max, 1),
    windowBlur: flag(raw.windowBlur, true),
    floatingOpacity: clamp(raw.floatingOpacity, OPACITY.min, OPACITY.max, 1),
    floatingBlur: flag(raw.floatingBlur, true),
    floatingBorder: flag(raw.floatingBorder, true),
    floatingTheme: id(raw.floatingTheme, DEFAULTS.floatingTheme),
    floatingAppearance: oneOf(raw.floatingAppearance, [...APPEARANCES, "same"] as const, "same"),
    floatingButtons: oneOf(raw.floatingButtons, ["hover", "always"] as const, DEFAULTS.floatingButtons),
    floatingOverFullscreen: flag(raw.floatingOverFullscreen, true),
    paper: oneOf(raw.paper, ["a4", "letter"] as const, DEFAULTS.paper),
    typesetter: id(raw.typesetter, DEFAULTS.typesetter),
    sidebarWidth: clamp(raw.sidebarWidth, PANE_WIDTHS.sidebar.min, PANE_WIDTHS.sidebar.max, DEFAULTS.sidebarWidth),
    listWidth: clamp(raw.listWidth, PANE_WIDTHS.list.min, PANE_WIDTHS.list.max, DEFAULTS.listWidth),
    sideWidth: clamp(raw.sideWidth, PANE_WIDTHS.side.min, PANE_WIDTHS.side.max, DEFAULTS.sideWidth),
    sidebarSide: oneOf(raw.sidebarSide, SIDES, DEFAULTS.sidebarSide),
    listSide: oneOf(raw.listSide, SIDES, DEFAULTS.listSide),
    tabs: flag(raw.tabs, DEFAULTS.tabs),
    outline: flag(raw.outline, DEFAULTS.outline),
    outlineSide: oneOf(raw.outlineSide, SIDES, DEFAULTS.outlineSide),
    symbolsInText: flag(raw.symbolsInText, DEFAULTS.symbolsInText),
    symbolsInCode: flag(raw.symbolsInCode, DEFAULTS.symbolsInCode),
    links: readLinks(raw.links),
    sheetStats: Array.isArray(raw.sheetStats) ? SHEET_STATS.filter((stat) => (raw.sheetStats as unknown[]).includes(stat)) : DEFAULTS.sheetStats,
    sheetDates: oneOf(raw.sheetDates, DATE_STYLES, DEFAULTS.sheetDates),
    sheetMoney: oneOf(raw.sheetMoney, MONEY_STYLES, DEFAULTS.sheetMoney),
    sheetCurrency: oneOf(raw.sheetCurrency, CURRENCIES, DEFAULTS.sheetCurrency),
    sheetNegative: oneOf(raw.sheetNegative, NEGATIVE_STYLES, DEFAULTS.sheetNegative),
    sheetMoneyEdge: flag(raw.sheetMoneyEdge, DEFAULTS.sheetMoneyEdge),
    sheetHeadings: flag(raw.sheetHeadings, DEFAULTS.sheetHeadings),
    sheetHeaderRow: flag(raw.sheetHeaderRow, DEFAULTS.sheetHeaderRow),
    sheetHeaderColumn: flag(raw.sheetHeaderColumn, DEFAULTS.sheetHeaderColumn),
  };
}

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const contrastQuery = window.matchMedia("(prefers-contrast: more)");

class Prefs {
  #initial = read();
  theme = $state(this.#initial.theme);
  appearance = $state<Appearance>(this.#initial.appearance);
  contrast = $state<Contrast>(this.#initial.contrast);
  font = $state<FontId>(this.#initial.font);
  textSize = $state(this.#initial.textSize);
  icons = $state(this.#initial.icons);
  swipe = $state<SwipeDirection>(this.#initial.swipe);
  windowOpacity = $state(this.#initial.windowOpacity);
  windowBlur = $state(this.#initial.windowBlur);
  floatingOpacity = $state(this.#initial.floatingOpacity);
  floatingBlur = $state(this.#initial.floatingBlur);
  floatingBorder = $state(this.#initial.floatingBorder);
  floatingTheme = $state(this.#initial.floatingTheme);
  floatingAppearance = $state<Appearance | "same">(this.#initial.floatingAppearance);
  floatingButtons = $state<WindowButtons>(this.#initial.floatingButtons);
  floatingOverFullscreen = $state(this.#initial.floatingOverFullscreen);
  paper = $state<Paper>(this.#initial.paper);
  typesetter = $state(this.#initial.typesetter);
  sidebarWidth = $state(this.#initial.sidebarWidth);
  listWidth = $state(this.#initial.listWidth);
  sideWidth = $state(this.#initial.sideWidth);
  sidebarSide = $state(this.#initial.sidebarSide);
  listSide = $state(this.#initial.listSide);
  tabs = $state(this.#initial.tabs);
  outline = $state(this.#initial.outline);
  outlineSide = $state(this.#initial.outlineSide);
  symbolsInText = $state(this.#initial.symbolsInText);
  symbolsInCode = $state(this.#initial.symbolsInCode);
  sheetStats = $state(this.#initial.sheetStats);
  sheetDates = $state(this.#initial.sheetDates);
  sheetMoney = $state(this.#initial.sheetMoney);
  sheetCurrency = $state(this.#initial.sheetCurrency);
  sheetNegative = $state(this.#initial.sheetNegative);
  sheetMoneyEdge = $state(this.#initial.sheetMoneyEdge);
  sheetHeadings = $state(this.#initial.sheetHeadings);
  sheetHeaderRow = $state(this.#initial.sheetHeaderRow);
  sheetHeaderColumn = $state(this.#initial.sheetHeaderColumn);
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
  /** This window's theme (by id; themes.svelte.ts shows it) and whether it's dark: a floating note can have its own. */
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
    return [this.font, this.textSize, $state.snapshot(this.spacing)];
  }

  #apply() {
    const root = document.documentElement;
    root.dataset.font = this.font;
    if (this.moreContrast) root.dataset.contrast = "more";
    else delete root.dataset.contrast;
    const { style } = root;
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
    // The light inner edge belongs with the window's outline; without a border, neither.
    if (isFloating && !this.floatingBorder) root.dataset.borderless = "";
    else delete root.dataset.borderless;
  }

  #serialize() {
    const stored: Stored = {
      theme: this.theme,
      appearance: this.appearance,
      contrast: this.contrast,
      font: this.font,
      textSize: this.textSize,
      icons: this.icons,
      swipe: this.swipe,
      spacing: $state.snapshot(this.spacing),
      noteWidth: this.noteWidth,
      fullWidth: this.fullWidth,
      windowOpacity: this.windowOpacity,
      windowBlur: this.windowBlur,
      floatingOpacity: this.floatingOpacity,
      floatingBlur: this.floatingBlur,
      floatingBorder: this.floatingBorder,
      floatingTheme: this.floatingTheme,
      floatingAppearance: this.floatingAppearance,
      floatingButtons: this.floatingButtons,
      floatingOverFullscreen: this.floatingOverFullscreen,
      paper: this.paper,
      typesetter: this.typesetter,
      sidebarWidth: this.sidebarWidth,
      listWidth: this.listWidth,
      sideWidth: this.sideWidth,
      sidebarSide: this.sidebarSide,
      listSide: this.listSide,
      tabs: this.tabs,
      outline: this.outline,
      outlineSide: this.outlineSide,
      symbolsInText: this.symbolsInText,
      symbolsInCode: this.symbolsInCode,
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
    };
    return JSON.stringify(stored);
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
    this.appearance = next.appearance;
    this.contrast = next.contrast;
    this.font = next.font;
    this.textSize = next.textSize;
    this.icons = next.icons;
    this.swipe = next.swipe;
    if (!sameSpacing(this.spacing, next.spacing)) this.spacing = next.spacing;
    this.noteWidth = next.noteWidth;
    this.fullWidth = next.fullWidth;
    this.windowOpacity = next.windowOpacity;
    this.windowBlur = next.windowBlur;
    this.floatingOpacity = next.floatingOpacity;
    this.floatingBlur = next.floatingBlur;
    this.floatingBorder = next.floatingBorder;
    this.floatingTheme = next.floatingTheme;
    this.floatingAppearance = next.floatingAppearance;
    this.floatingButtons = next.floatingButtons;
    this.floatingOverFullscreen = next.floatingOverFullscreen;
    this.paper = next.paper;
    this.typesetter = next.typesetter;
    this.sidebarWidth = next.sidebarWidth;
    this.listWidth = next.listWidth;
    this.sideWidth = next.sideWidth;
    this.sidebarSide = next.sidebarSide;
    this.listSide = next.listSide;
    this.tabs = next.tabs;
    this.outline = next.outline;
    this.outlineSide = next.outlineSide;
    this.symbolsInText = next.symbolsInText;
    this.symbolsInCode = next.symbolsInCode;
    if (next.sheetStats.join() !== this.sheetStats.join()) this.sheetStats = next.sheetStats;
    this.sheetDates = next.sheetDates;
    this.sheetMoney = next.sheetMoney;
    this.sheetCurrency = next.sheetCurrency;
    this.sheetNegative = next.sheetNegative;
    this.sheetMoneyEdge = next.sheetMoneyEdge;
    this.sheetHeadings = next.sheetHeadings;
    this.sheetHeaderRow = next.sheetHeaderRow;
    this.sheetHeaderColumn = next.sheetHeaderColumn;
    if (JSON.stringify(this.links) !== JSON.stringify(next.links)) this.links = next.links;
    // As already saved, so taking it up here doesn't send it back out.
    this.#saved = this.#serialize();
  }
}

export const prefs = new Prefs();
