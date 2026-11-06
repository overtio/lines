import { announce, onAnnounce } from "../windows/channel";
import { format, type Params } from "./format";
import en from "./locales/en";
import es from "./locales/es";
import fr from "./locales/fr";

/*
 * Translations. Every piece of text the app shows is a message in locales/en/ (English, which is
 * also what any message a language lacks falls back to), looked up with t():
 *
 *   t("sidebar.notes")                      → "Notes"
 *   t("list.count", { count: 3 })           → "3 notes"
 *
 * Adding a language is a folder in locales/ and a line in LANGUAGES; see docs/translations.md.
 * The language is chosen in Settings → General, or follows the system's.
 */

export type MessageKey = keyof typeof en;
/** A language's messages: any of English's keys (and no others), each a translation of it. */
export type Messages = Partial<Record<MessageKey, string>>;

/** The languages lines speaks, by BCP 47 tag, each named in its own language. */
export const LANGUAGES = [
  { id: "en", name: "English", messages: en as Messages },
  { id: "es", name: "Español", messages: es as Messages },
  { id: "fr", name: "Français", messages: fr as Messages },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];
export type LanguageChoice = LanguageId | "system";

const KEY = "lines.language";

function stored(): LanguageChoice {
  try {
    const value = localStorage.getItem(KEY);
    if (value && LANGUAGES.some((language) => language.id === value)) return value as LanguageId;
  } catch {
    // Unreadable storage: follow the system.
  }
  return "system";
}

/** The first of the system's languages that lines speaks, or English. */
function systemLanguage(): LanguageId {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    const found = LANGUAGES.find((language) => language.id === base);
    if (found) return found.id;
  }
  return "en";
}

/** What was chosen in Settings: a language, or "system". */
export const languageChoice: LanguageChoice = stored();
/** The language the app is in. It's read once: changing it restarts the app (see setLanguage). */
export const language: LanguageId = languageChoice === "system" ? systemLanguage() : languageChoice;
const messages = LANGUAGES.find((entry) => entry.id === language)!.messages;

/**
 * The locale dates and numbers are written in: the device's own variant of the app's language when
 * it has one (en-GB, with its 24-hour clock; fr-CA), or else the language.
 */
export const locale: string =
  (navigator.languages ?? [navigator.language]).find((tag) => tag.toLowerCase().split("-")[0] === language) ?? language;

document.documentElement.lang = language;

/** The message `key` in the app's language (English if it hasn't been translated), with `params` filled in. */
export function t(key: MessageKey, params?: Params): string {
  return format(messages[key] ?? en[key], params, locale);
}

/**
 * Switches the app's language. Everything on screen is redrawn by starting again, in every window;
 * the caller saves what's being typed first.
 */
export function setLanguage(choice: LanguageChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    return;
  }
  void announce({ type: "prefs" }).finally(() => location.reload());
}

// Another window switched the language: start again in it too.
void onAnnounce((message) => {
  if (message.type === "prefs" && stored() !== languageChoice) location.reload();
});
