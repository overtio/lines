import type { IconName } from "./icons/icons";

export type Layout = "wide" | "medium" | "narrow";
export type SettingsTab = "appearance" | "text" | "sync" | "privacy" | "shortcuts" | "about";

export type MenuItem = { label: string; icon?: IconName; danger?: boolean; run: () => void } | "separator";

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
  /** For something that can have no icon at all (a callout): whether it has none, and choosing none. */
  none?: { active: () => boolean; set: () => void };
  /** Where to open, in viewport coordinates. */
  x: number;
  y: number;
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
  /** The open Settings tab, or null when Settings is closed. */
  settings = $state<SettingsTab | null>(null);
  menu = $state.raw<Menu | null>(null);
  /** What an icon is being picked for, and where the picker opens. */
  iconPicker = $state.raw<IconTarget | null>(null);
  /**
   * The note whose PDF is being previewed, and whether to save (or print) it as soon as it's ready,
   * or to offer its PNG images.
   */
  pdf = $state.raw<{ id: string; save: boolean; png?: boolean } | null>(null);

  constructor() {
    window.addEventListener("resize", () => {
      const next = layoutFor(window.innerWidth);
      if (next === this.layout) return;
      this.layout = next;
      this.sidebarOpen = next === "wide";
    });
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
