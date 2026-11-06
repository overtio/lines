# Translations

lines speaks English, Spanish and French. Settings → General → Language chooses one, or **System** follows the device's language (English when lines doesn't speak it). Changing it starts lines again, in every window, after saving what's being typed.

Notes themselves aren't translated: the welcome note, the feature tour and the examples are in English.

## How it works

Every piece of text the app shows is a **message** in `src/lib/i18n/locales/en/`, one file per area of the app (`sidebar.ts`, `settings.ts`, `editor.ts`…). Code looks a message up by its key with `t()`:

```ts
import { t } from "../i18n/index.svelte";

t("sidebar.notes"); // "Notes"
t("list.count", { count: 3 }); // "3 notes"
```

Other languages have the same files, each translating English's messages. A message a language hasn't translated shows in English. `src/lib/i18n/index.svelte.ts` picks the language and `src/lib/i18n/format.ts` fills messages in.

Dates and numbers are written the device's way in the app's language: `en-GB` with a 24-hour clock, `fr-CA` as Canada writes them (`locale` in `index.svelte.ts`).

## Adding a language

1. Copy `src/lib/i18n/locales/fr/` to a folder named for the language's [BCP 47](https://www.rfc-editor.org/info/bcp47) tag, like `de/` or `pt-BR/`.
2. Translate the messages in each file. Keys stay as they are.
3. Add it to `LANGUAGES` in `src/lib/i18n/index.svelte.ts`, named in its own language (`{ id: "de", name: "Deutsch", messages: de }`), with its import.
4. `pnpm i18n` lists any message not yet translated, file by file. `pnpm check` finds keys English doesn't have (a typo, or a message since removed).

A language can ship partly translated; what's missing shows in English.

## Writing messages

- **Placeholders** are names in braces: `"Synced {date}"`. Keep them as they are; move them where the language needs them.
- **Plurals** use ICU's form: `"{count, plural, one {# note} other {# notes}}"`. `#` is the number. Use the categories the language has ([CLDR plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)): `one` and `other` for English and Spanish; French's `one` covers 0 and 1; Russian or Polish add `few` and `many`. `=0 {No notes}` matches an exact number.
- **Whole sentences** are one message. Code never joins messages into a sentence, since word order differs between languages.
- **Leave as they are:** "lines" (always lowercase), product and service names (iCloud Drive, Touch ID, S3, Markdown, LaTeX, Unsplash, GitHub), file extensions, and Markdown or LaTeX syntax in a message (`#tag`, `/`, `\section`).
- **Punctuation:** "…" (one character) on a menu item that asks for more before acting, as in "Rename…". Typographic quotes and apostrophes: “ ” ’ in English, « » with narrow no-break spaces and ’ in French, “ ” or « » in Spanish.
- **Voice:** as Apple writes its own apps in each language. Spanish uses tú; French uses vous. Settings is "Ajustes" in Spanish and "Réglages" in French.
- **Labels for screen readers** (`aria-label`) are messages too: say what a button does ("Hide sidebar"), not what it looks like.

## Adding text to the app

New text goes into the English file for its area, with a key starting with that area (`list.emptyTrash`), and is looked up with `t()`. Add the Spanish and French while you're there if you can; otherwise `pnpm i18n` lists them for a translator. Text set once when a file loads (`const LABELS = [t("…")]`) is fine, because the language never changes while lines runs.
