/*
 * Messages are plain text with a few placeholders, a small part of ICU MessageFormat:
 *
 *   "Hello, {name}"
 *   "{count, plural, one {# note} other {# notes}}"
 *   "{count, plural, =0 {No notes} one {# note} other {# notes}}"
 *
 * In a plural, `#` is the number, written the language's way; the categories are the language's
 * own (Intl.PluralRules: French's `one` is 0 and 1, for example).
 */

export type Params = Record<string, string | number>;

const pluralRules = new Map<string, Intl.PluralRules>();
const numbers = new Map<string, Intl.NumberFormat>();

function plural(locale: string, count: number) {
  let rules = pluralRules.get(locale);
  if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(locale)));
  return rules.select(count);
}

function number(locale: string, value: number) {
  let format = numbers.get(locale);
  if (!format) numbers.set(locale, (format = new Intl.NumberFormat(locale)));
  return format.format(value);
}

/** The text between the brace at `open` and its closing one. */
function block(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

/** A plural's options, `one {# note} other {# notes}`, by category or `=N`. */
function options(text: string): Map<string, string> {
  const found = new Map<string, string>();
  const re = /\s*(=?\w+)\s*\{/g;
  for (let match = re.exec(text); match; match = re.exec(text)) {
    const open = match.index + match[0].length - 1;
    const body = block(text, open);
    found.set(match[1], body);
    re.lastIndex = open + body.length + 2;
  }
  return found;
}

/** `message` with its placeholders filled in from `params`, for `locale`. */
export function format(message: string, params: Params | undefined, locale: string): string {
  if (!params || !message.includes("{")) return message;
  let out = "";
  for (let i = 0; i < message.length; ) {
    const open = message.indexOf("{", i);
    if (open < 0) {
      out += message.slice(i);
      break;
    }
    out += message.slice(i, open);
    const inner = block(message, open);
    i = open + inner.length + 2;
    const [name, kind, ...rest] = inner.split(",");
    const value = params[name.trim()];
    if (kind?.trim() === "plural" && typeof value === "number") {
      const choices = options(rest.join(","));
      const chosen = choices.get(`=${value}`) ?? choices.get(plural(locale, value)) ?? choices.get("other") ?? "";
      // The number first, so a `#` in a value filled in (a tag, say) stays.
      out += format(chosen.replace(/#/g, number(locale, value)), params, locale);
    } else {
      out += value === undefined ? `{${inner}}` : typeof value === "number" ? number(locale, value) : value;
    }
  }
  return out;
}

/** A translation of one of English's message files (`typeof en`): any of its keys, and no others. */
export type Translation<English> = Partial<Record<keyof English, string>>;
