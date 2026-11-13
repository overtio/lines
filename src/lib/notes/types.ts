import type { LockedKey } from "../crypto";
import type { IconName } from "../icons/icons";
import type { PaletteColor } from "../palette";
import type { Property } from "./properties";

export interface Note {
  id: string;
  /** The note's text, as written in its language. This is the only source of truth for content. */
  body: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  trashed: boolean;
  /** In the Inbox: new, and not sorted yet. */
  inbox?: boolean;
  /** An icon chosen for the note, shown before its title in the list. */
  icon?: IconName;
  /** A color chosen for the note: its icon's in the list, and its event's and dot's on the Calendar (palette.ts). */
  color?: PaletteColor;
  /**
   * The language it's written in, by the id of a language a plugin adds ("latex"), for a note not
   * written in Markdown. Kept even while that plugin is off, or not on this device.
   */
  format?: string;
  /** Set for a note locked with the locked-notes password (see notes/noteKeys.svelte.ts). */
  locked?: NoteLock;
}

/** The key a locked note is encrypted with, locked with the password. Notes locked with the same password share it. */
export interface WrappedKey extends LockedKey {
  id: string;
  /** When the password was last set, so the newest wrapping of a key wins across devices. */
  changed: number;
}

/**
 * A locked note keeps its body encrypted, here and wherever it syncs to. The rest stays readable,
 * so the list can show it: its title, dates, pin and icon.
 */
export interface NoteLock {
  /** The key, locked with the password, so the note opens on any device that knows it. */
  key: WrappedKey;
  /** Its first line, as the list shows it. */
  title: string;
  /** The attachments it shows. They aren't encrypted, and are kept and synced while it's locked. */
  files: string[];
  /** The note's Markdown, encrypted (base64). Empty while an edit is waiting to be encrypted. */
  sealed: string;
  /** In memory only: the note is open, its Markdown in `body`. */
  open?: boolean;
}

/** Derived, cached data computed from a note's body. */
export interface NoteMeta {
  title: string;
  excerpt: string;
  tags: string[];
  hasOpenTodos: boolean;
  searchText: string;
  /** The `key: value` lines of its front matter (notes/properties.ts). */
  properties: Property[];
  /** Its `type` property, lowercased; empty for a note without one. */
  type: string;
}

export type Filter =
  | { kind: "inbox" }
  | { kind: "all" }
  | { kind: "todo" }
  | { kind: "untagged" }
  | { kind: "trash" }
  | { kind: "tag"; tag: string }
  | { kind: "type"; type: string }
  /** A shelf of the Library (library/shelves.svelte.ts), by its key: the notes of its kinds. */
  | { kind: "library"; shelf: string }
  /** The Calendar, on one day (`YYYY-MM-DD`, see calendar.ts): the notes on it. */
  | { kind: "calendar"; day: string };
