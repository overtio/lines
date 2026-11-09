import { describe, expect, test } from "bun:test";
import { format } from "../../src/lib/i18n/format";
import en from "../../src/lib/i18n/locales/en";
import es from "../../src/lib/i18n/locales/es";
import fr from "../../src/lib/i18n/locales/fr";

const english = en as Record<string, string>;
const translations = { es: es as Record<string, string>, fr: fr as Record<string, string> };

/** The names a message fills in: `{name}` and `{count, plural, …}`, not `{{name}}`, which is written as it is. */
const placeholders = (message: string) => new Set([...message.replace(/\{\{\w+\}\}/g, "").matchAll(/\{(\w+)(?=[},])/g)].map((match) => match[1]));

describe("messages", () => {
  test("each translation fills in the same things as the English", () => {
    const wrong: string[] = [];
    for (const [language, messages] of Object.entries(translations)) {
      for (const [key, message] of Object.entries(messages)) {
        const want = [...placeholders(english[key] ?? "")].sort().join(",");
        const have = [...placeholders(message)].sort().join(",");
        if (want !== have) wrong.push(`${language} ${key}: {${have}} for {${want}}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test("every plural has `other`, and every message formats", () => {
    for (const [language, messages] of [["en", english], ...Object.entries(translations)] as const) {
      for (const [key, message] of Object.entries(messages)) {
        if (message.includes(", plural,")) expect(message, `${language} ${key}`).toMatch(/\bother\s*\{/);
        const names = [...placeholders(message)];
        if (!names.length) continue;
        const formatted = format(message, Object.fromEntries(names.map((name) => [name, 2])), language);
        expect(formatted, `${language} ${key}`).not.toMatch(/\{\w+[},]/);
      }
    }
  });

  test("no translation is left that English no longer has", () => {
    for (const [language, messages] of Object.entries(translations)) expect(Object.keys(messages).filter((key) => !(key in english)), language).toEqual([]);
  });
});
