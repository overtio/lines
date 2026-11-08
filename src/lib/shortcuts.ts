import { type MessageKey, t } from "./i18n/index.svelte";
import { isApple, isDesktopApp, isTauri } from "./platform";

/*
 * Every keyboard shortcut lines has, for Settings → Shortcuts. Keys are written as CodeMirror
 * writes them ("Mod-Shift-f": ⌘ on Apple devices, Ctrl elsewhere) and shown each platform's way:
 * ⌘⇧F on a Mac, Ctrl+Shift+F on Windows and Linux. When a shortcut changes, change it here too.
 */

export type System = "mac" | "other";

/** Keys, the same everywhere or different on a Mac. */
type Keys = string | { mac: string; other: string };

export interface Shortcut {
  action: MessageKey;
  /** Each way to do it: shown with "or" between. */
  keys: Keys[];
  /** When it applies: only in the apps (not the web), only on the web, or only in the desktop apps. */
  only?: "app" | "web" | "desktop";
  /** A few words on when it works. */
  note?: MessageKey;
}

export interface ShortcutGroup {
  name: MessageKey;
  shortcuts: Shortcut[];
}

export const SHORTCUTS: ShortcutGroup[] = [
  {
    name: "shortcuts.group.general",
    shortcuts: [
      // Browsers keep ⌘N (Ctrl+N) for a new window, so the web app uses ⌥N (Alt+N); see platform.ts.
      { action: "shortcuts.newNote", keys: ["Mod-n"], only: "app" },
      { action: "shortcuts.newNote", keys: ["Alt-n"], only: "web" },
      { action: "shortcuts.search", keys: ["Mod-Shift-f"] },
      { action: "shortcuts.sidebar", keys: ["Mod-\\"] },
      { action: "shortcuts.focus", keys: ["Mod-Shift-\\"] },
      { action: "shortcuts.list", keys: ["Mod-/"] },
      { action: "shortcuts.pdf", keys: ["Mod-p"] },
      { action: "shortcuts.textBigger", keys: ["Mod-+"] },
      { action: "shortcuts.textSmaller", keys: ["Mod--"] },
      { action: "shortcuts.textUsual", keys: ["Mod-0"] },
      { action: "shortcuts.lock", keys: [{ mac: "Ctrl-Mod-l", other: "Ctrl-Alt-l" }], note: "shortcuts.lockNote" },
      { action: "shortcuts.closeFloating", keys: ["Mod-w"], only: "desktop" },
      { action: "shortcuts.undoTrash", keys: ["Mod-z"], note: "shortcuts.undoTrashNote" },
    ],
  },
  {
    name: "shortcuts.group.moving",
    shortcuts: [
      { action: "shortcuts.panes", keys: ["F6", "Shift-F6"] },
      { action: "shortcuts.notes", keys: ["ArrowUp", "ArrowDown"], note: "shortcuts.inList" },
      { action: "shortcuts.firstLast", keys: ["Home", "End"], note: "shortcuts.inList" },
      { action: "shortcuts.open", keys: ["Enter"], note: "shortcuts.inList" },
      { action: "shortcuts.pickOne", keys: ["Mod-click"], note: "shortcuts.inList" },
      { action: "shortcuts.pickRange", keys: ["Shift-click", "Shift-ArrowUp", "Shift-ArrowDown"], note: "shortcuts.inList" },
      { action: "shortcuts.openBeside", keys: ["Alt-click"], note: "shortcuts.inList" },
      { action: "shortcuts.pickAll", keys: ["Mod-a"], note: "shortcuts.inList" },
      { action: "shortcuts.trashPicked", keys: ["Backspace"], note: "shortcuts.inList" },
      { action: "shortcuts.menu", keys: ["Shift-F10"] },
      { action: "shortcuts.openAtCursor", keys: ["Alt-Enter"], note: "shortcuts.inNote" },
      { action: "shortcuts.openLink", keys: ["Mod-click"], note: "shortcuts.linksSetting" },
      { action: "shortcuts.close", keys: ["Escape"] },
    ],
  },
  {
    name: "shortcuts.group.writing",
    shortcuts: [
      { action: "shortcuts.commands", keys: ["/"], note: "shortcuts.commandsNote" },
      { action: "shortcuts.mention", keys: ["@", "[["] },
      { action: "shortcuts.mathCommands", keys: ["\\"], note: "shortcuts.inMath" },
      { action: "shortcuts.complete", keys: ["Tab"], note: "shortcuts.inMenu" },
      { action: "shortcuts.todo", keys: ["Mod-Enter"] },
      { action: "shortcuts.sendRequest", keys: ["Mod-Enter"], note: "shortcuts.inRequest" },
      { action: "shortcuts.sendAllRequests", keys: ["Mod-Shift-Enter"], note: "shortcuts.inRequest" },
      { action: "shortcuts.nest", keys: ["Tab", "Shift-Tab"], note: "shortcuts.inListItem" },
      { action: "shortcuts.moveLines", keys: ["Alt-ArrowUp", "Alt-ArrowDown"] },
      { action: "shortcuts.undo", keys: ["Mod-z"] },
      // CodeMirror's history keys: ⌘⇧Z on a Mac, Ctrl+Y elsewhere (and Ctrl+Shift+Z on Linux).
      { action: "shortcuts.redo", keys: [{ mac: "Mod-Shift-z", other: "Mod-y" }] },
      { action: "shortcuts.editDrawing", keys: ["Enter"], note: "shortcuts.drawingSelected" },
      { action: "shortcuts.saveDrawing", keys: ["Mod-s"], note: "shortcuts.inDrawing" },
    ],
  },
  {
    name: "shortcuts.group.formatting",
    shortcuts: [
      { action: "shortcuts.bold", keys: ["Mod-b"] },
      { action: "shortcuts.italic", keys: ["Mod-i"] },
      { action: "shortcuts.underline", keys: ["Mod-u"] },
      { action: "shortcuts.code", keys: ["Mod-e"] },
      { action: "shortcuts.strike", keys: ["Mod-Shift-x"], note: "shortcuts.markdownOnly" },
      { action: "shortcuts.highlight", keys: ["Mod-Shift-h"], note: "shortcuts.markdownOnly" },
    ],
  },
  {
    name: "shortcuts.group.tables",
    shortcuts: [
      { action: "shortcuts.nextCell", keys: ["Tab", "Shift-Tab"] },
      { action: "shortcuts.newRow", keys: ["Enter"] },
    ],
  },
  {
    name: "shortcuts.group.sheets",
    shortcuts: [
      { action: "shortcuts.sheetMove", keys: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Shift-Tab"] },
      { action: "shortcuts.sheetSelect", keys: ["Shift-ArrowDown", "Shift-click"] },
      { action: "shortcuts.sheetEdge", keys: ["Mod-ArrowDown", "Mod-ArrowRight", "Home", "End"] },
      { action: "shortcuts.sheetAll", keys: ["Mod-a"] },
      { action: "shortcuts.sheetEdit", keys: ["Enter", "F2"], note: "shortcuts.sheetTyping" },
      { action: "shortcuts.sheetKeep", keys: ["Enter", "Shift-Enter", "Tab"], note: "shortcuts.inCell" },
      { action: "shortcuts.sheetCancel", keys: ["Escape"], note: "shortcuts.inCell" },
      { action: "shortcuts.sheetBreak", keys: ["Alt-Enter"], note: "shortcuts.inCell" },
      { action: "shortcuts.sheetPoint", keys: ["ArrowUp", "Shift-ArrowUp", "click"], note: "shortcuts.inFormula" },
      { action: "shortcuts.sheetSuggestion", keys: ["Enter", "Tab"], note: "shortcuts.inSuggestions" },
      { action: "shortcuts.sheetClear", keys: ["Backspace"] },
      { action: "shortcuts.sheetFillDown", keys: ["Mod-d"] },
      { action: "shortcuts.sheetFillRight", keys: ["Mod-r"] },
      { action: "shortcuts.sheetAutofill", keys: ["drag"], note: "shortcuts.onCorner" },
      { action: "shortcuts.sheetAutofillOther", keys: [{ mac: "Alt-drag", other: "Ctrl-drag" }], note: "shortcuts.onCorner" },
      { action: "shortcuts.sheetMoveCells", keys: ["drag"], note: "shortcuts.afterHolding" },
      { action: "shortcuts.sheetMenu", keys: ["Shift-F10"] },
      { action: "shortcuts.sheetInOut", keys: ["ArrowDown", "ArrowUp"], note: "shortcuts.besideSheet" },
    ],
  },
  {
    name: "shortcuts.group.models",
    shortcuts: [
      { action: "shortcuts.modelTurn", keys: ["drag", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"], note: "shortcuts.onModel" },
      { action: "shortcuts.modelMove", keys: ["Shift-drag", "Shift-ArrowLeft", "Shift-ArrowUp"], note: "shortcuts.onModel" },
      { action: "shortcuts.modelZoom", keys: ["Mod-scroll", "+", "-"], note: "shortcuts.onModel" },
      { action: "shortcuts.modelReset", keys: ["0"], note: "shortcuts.onModel" },
    ],
  },
  {
    name: "shortcuts.group.find",
    shortcuts: [
      { action: "shortcuts.find", keys: ["Mod-f"], note: "shortcuts.inNote" },
      { action: "shortcuts.findNext", keys: ["Mod-g", "Mod-Shift-g"] },
      { action: "shortcuts.selectNext", keys: ["Mod-d"] },
      { action: "shortcuts.goToLine", keys: ["Mod-Alt-g"] },
    ],
  },
];

/** The system lines runs on, for the keys it shows first. */
export const system: System = isApple ? "mac" : "other";

/** Whether a shortcut applies where lines is running: in an app, on the web, or in a desktop app. */
export function applies(shortcut: Shortcut) {
  if (shortcut.only === "app") return isTauri;
  if (shortcut.only === "web") return !isTauri;
  if (shortcut.only === "desktop") return isDesktopApp;
  return true;
}

/** A Mac's modifier symbols, in the order Apple writes them: ⌃⌥⇧⌘. */
const MAC_ORDER = ["Ctrl", "Alt", "Shift", "Mod"];
const MAC_SYMBOLS: Record<string, string> = { Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Mod: "⌘" };
/** And Windows and Linux's order, as they write them: Ctrl+Alt+Shift. */
const OTHER_ORDER = ["Mod", "Ctrl", "Alt", "Shift"];

const MAC_KEYS: Record<string, string> = { Enter: "↵", Tab: "⇥", Backspace: "⌫", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
const ARROWS: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };

/** A key as printed on keyboards in the app's language ("Intro", "Entrée"), or as itself. */
function keyName(key: string, on: System): string {
  if (key === "click") return t("shortcuts.key.click");
  if (key === "drag") return t("shortcuts.key.drag");
  if (key === "scroll") return t("shortcuts.key.scroll");
  if (on === "mac" && MAC_KEYS[key]) return MAC_KEYS[key];
  if (ARROWS[key]) return ARROWS[key];
  const named: Record<string, MessageKey> = {
    Enter: "shortcuts.key.enter",
    Tab: "shortcuts.key.tab",
    Escape: "shortcuts.key.escape",
    Home: "shortcuts.key.home",
    End: "shortcuts.key.end",
    Backspace: "shortcuts.key.backspace",
  };
  if (named[key]) return t(named[key]);
  return key.length === 1 ? key.toUpperCase() : key;
}

/** How `keys` are written on `on`: "⌘⇧F" on a Mac, "Ctrl+Shift+F" elsewhere. */
export function formatKeys(keys: Keys, on: System): string {
  const spec = typeof keys === "string" ? keys : keys[on];
  // The last part is the key (a "-" at the end is the key itself); the rest are modifiers.
  const parts = spec.split(/-(?=.)/);
  const key = parts.pop()!;
  const modifiers = new Set(parts);
  if (on === "mac") {
    const symbols = MAC_ORDER.filter((m) => modifiers.has(m)).map((m) => MAC_SYMBOLS[m]).join("");
    // A click, drag or scroll reads as words after the symbols: ⌘-click.
    return (key === "click" || key === "drag" || key === "scroll") && symbols ? `${symbols}-${keyName(key, on)}` : symbols + keyName(key, on);
  }
  const names: Record<string, string> = { Mod: t("shortcuts.key.ctrl"), Ctrl: t("shortcuts.key.ctrl"), Alt: t("shortcuts.key.alt"), Shift: t("shortcuts.key.shift") };
  return [...OTHER_ORDER.filter((m) => modifiers.has(m)).map((m) => names[m]), keyName(key, on)].join("+");
}

/**
 * The same keys in words, for screen readers, which may read "⌘⇧F" as symbols or not at all:
 * "Command Shift F".
 */
export function speakKeys(keys: Keys, on: System): string {
  const spec = typeof keys === "string" ? keys : keys[on];
  const parts = spec.split(/-(?=.)/);
  const key = parts.pop()!;
  const modifiers = new Set(parts);
  const order = on === "mac" ? MAC_ORDER : OTHER_ORDER;
  const words: Record<string, MessageKey> =
    on === "mac"
      ? { Ctrl: "shortcuts.key.control", Alt: "shortcuts.key.option", Shift: "shortcuts.key.shiftWord", Mod: "shortcuts.key.command" }
      : { Mod: "shortcuts.key.ctrl", Ctrl: "shortcuts.key.ctrl", Alt: "shortcuts.key.alt", Shift: "shortcuts.key.shiftWord" };
  const spokenKeys: Record<string, MessageKey> = {
    ArrowUp: "shortcuts.key.up",
    ArrowDown: "shortcuts.key.down",
    ArrowLeft: "shortcuts.key.left",
    ArrowRight: "shortcuts.key.right",
    Enter: "shortcuts.key.enter",
    Tab: "shortcuts.key.tab",
    Escape: "shortcuts.key.escape",
    Home: "shortcuts.key.home",
    End: "shortcuts.key.end",
    Backspace: "shortcuts.key.backspace",
    click: "shortcuts.key.click",
    drag: "shortcuts.key.drag",
    scroll: "shortcuts.key.scroll",
    "/": "shortcuts.key.slash",
    "\\": "shortcuts.key.backslash",
    "@": "shortcuts.key.at",
    "+": "shortcuts.key.plus",
    "-": "shortcuts.key.minus",
  };
  const spokenKey = spokenKeys[key] ? t(spokenKeys[key]) : key.length === 1 ? key.toUpperCase() : key;
  return [...order.filter((m) => modifiers.has(m)).map((m) => t(words[m])), spokenKey].join(" ");
}
