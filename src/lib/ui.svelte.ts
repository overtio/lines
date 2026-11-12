import type { PaletteColor } from "./palette";
import type { SettingsSection } from "./components/settings/sections";
import type { IconName } from "./icons/icons";
import { prefs } from "./prefs.svelte";

/** The narrowest the open note gets, beside the sidebar and note list or a note open beside it. */
export const NOTE_MIN = 360;

export type Layout = "wide" | "medium" | "narrow";

/** A menu's item, or a line between groups of them. One with `checked` is a choice, marked while it's the one made. */
export type MenuItem = { label: string; icon?: IconName; danger?: boolean; checked?: boolean; run: () => void } | "separator";

/** A menu in sections, a line between each; a section with nothing in it isn't one. */
export const menuSections = (...sections: Exclude<MenuItem, "separator">[][]): MenuItem[] =>
  sections.filter((section) => section.length).flatMap((section, i): MenuItem[] => (i ? ["separator", ...section] : section));

export interface Menu {
  /** Where to open, in viewport coordinates. */
  x: number;
  y: number;
  /** "end" lines the menu's right edge up with `x`. */
  align?: "start" | "end";
  /** The button that opened it; pressing it again closes the menu rather than reopening it. */
  anchor?: Element;
  /** What the menu is for, said by screen readers as it opens: "Share", a note's title. */
  label?: string;
  items: MenuItem[];
  onclose?: () => void;
}

/** Something whose icon is being picked: a tag or a note. */
export interface IconTarget {
  /** Which tag or note, e.g. to keep its row highlighted while the picker is open. */
  key: string;
  /** Its name, shown at the top of the picker. */
  label: string;
  /** What shows when it has no icon of its own. */
  fallback: IconName;
  icon: () => IconName | null;
  set: (icon: IconName | null) => void;
  /** For something that can have a color too (a tag, a type): its color, and choosing one; null for none. */
  color?: {
    get: () => PaletteColor | null;
    set: (color: PaletteColor | null) => void;
    /** What it has with no color of its own: a nested tag's from the tag it's in (`from`). */
    inherited?: { color: PaletteColor; from: string };
  };
  /** For something that can have no icon at all (a callout): whether it has none, and choosing none. */
  none?: { active: () => boolean; set: () => void };
  /** Where to open, in viewport coordinates. */
  x: number;
  y: number;
}

/** Notes a tag is being added to (the ones picked in the list), and where its box opens. */
export interface TagPrompt {
  ids: string[];
  x: number;
  y: number;
  /** Opened from a button: its right edge lines up with `x`. */
  align?: "start" | "end";
}

function layoutFor(width: number): Layout {
  return width >= 1000 ? "wide" : width >= 700 ? "medium" : "narrow";
}

class UIState {
  layout = $state<Layout>(layoutFor(window.innerWidth));
  /** On wide screens the sidebar is a column; otherwise it's a drawer. */
  sidebarOpen = $state(this.layout === "wide");
  /** Focus mode: just the note, with the sidebar and note list tucked away. */
  focus = $state(false);
  /** How wide and tall the note's place is (App.svelte), which decides whether a note fits beside the open one (panes.svelte.ts). */
  editorWidth = $state(0);
  editorHeight = $state(0);
  /** The open Settings tab, or null when Settings is closed. */
  settings = $state<SettingsSection | null>(null);
  menu = $state.raw<Menu | null>(null);
  /** What an icon is being picked for, and where the picker opens. */
  iconPicker = $state.raw<IconTarget | null>(null);
  /** Notes a tag is being added to, and where its box opens. */
  tagPrompt = $state.raw<TagPrompt | null>(null);
  /**
   * The note whose PDF is being previewed, and what it goes straight on to once it's ready:
   * printing, exporting the PDF (printed, or saved from a typesetter), or offering PNG images.
   */
  pdf = $state.raw<{ id: string; action?: "print" | "export" | "png" } | null>(null);

  constructor() {
    window.addEventListener("resize", () => {
      const next = layoutFor(window.innerWidth);
      if (next === this.layout) return;
      this.layout = next;
      this.sidebarOpen = next === "wide";
    });
  }

  /**
   * Where the button that shows the sidebar goes, while there's one: in the note list's title bar
   * when the list is on the sidebar's side (and always on a phone), or else at the note's edge on
   * that side. On a wide screen it's there while the sidebar is hidden; elsewhere, always.
   */
  get sidebarToggle(): "list" | "editor" | null {
    if ((this.layout === "wide" && this.sidebarOpen) || (this.focus && this.layout !== "narrow")) return null;
    return this.layout === "narrow" || prefs.listSide === prefs.sidebarSide ? "list" : "editor";
  }

  toggleSidebar() {
    // Leaving focus mode is the quickest way to show the sidebar again.
    if (this.focus) {
      this.focus = false;
      this.sidebarOpen = true;
    } else {
      this.sidebarOpen = !this.sidebarOpen;
    }
  }

  openMenu(menu: Menu) {
    this.closeMenu();
    this.menu = menu;
  }

  closeMenu() {
    const menu = this.menu;
    this.menu = null;
    menu?.onclose?.();
  }

  /** Close the drawer after navigating, unless it's a permanent column. */
  closeDrawer() {
    if (this.layout !== "wide") this.sidebarOpen = false;
  }
}

export const ui = new UIState();
