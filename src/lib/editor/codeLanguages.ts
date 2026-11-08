import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { plugins } from "../plugins/registry.svelte";

/*
 * The language a code block is highlighted as, by the name it gives (```sql, ```http): one a
 * plugin adds, else one CodeMirror knows. Each loads the first time a note uses it.
 */

/** Looked up once each, as every edit parses a note's code blocks again; forgotten when plugins change. */
const found = new Map<string, LanguageDescription | null>();
let foundIn: readonly LanguageDescription[] | undefined;

export function codeLanguage(name: string): LanguageDescription | null {
  const added = plugins.codeLanguages;
  if (foundIn !== added) {
    found.clear();
    foundIn = added;
  }
  let language = found.get(name);
  if (language === undefined) {
    language = LanguageDescription.matchLanguageName(added, name, true) ?? LanguageDescription.matchLanguageName(languages, name, true);
    found.set(name, language);
  }
  return language;
}
