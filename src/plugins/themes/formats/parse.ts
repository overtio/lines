/*
 * Just enough of the file formats themes come in to read their colors: JSON with comments (VS
 * Code's), the YAML and TOML that terminals and Base16 write, INI, and Apple's property lists. Each
 * gives null (or nothing) for text it can't read, rather than throwing.
 */

/** JSON that may have comments and trailing commas, as VS Code's settings and themes do. */
export function jsonc(text: string): unknown {
  let plain = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      const end = /"(?:[^"\\]|\\.)*"/y;
      end.lastIndex = i;
      const string = end.exec(text)?.[0] ?? text.slice(i);
      plain += string;
      i += string.length - 1;
    } else if (char === "/" && text[i + 1] === "/") {
      i = text.indexOf("\n", i) === -1 ? text.length : text.indexOf("\n", i) - 1;
    } else if (char === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) === -1 ? text.length : text.indexOf("*/", i + 2) + 1;
    } else {
      plain += char;
    }
  }
  try {
    return JSON.parse(plain.replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return null;
  }
}

/** A quoted or bare value, unquoted. */
const unquote = (value: string) => value.trim().replace(/^(["'])(.*)\1$/, "$2");

/** Text up to a comment that starts with `marker`, outside quotes. */
function uncomment(line: string, marker: string) {
  let quote = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (line.startsWith(marker, i) && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * YAML's nested maps of strings, flattened to dotted keys (`palette.base00`, `colors.primary.background`).
 * Lists and multi-line strings are skipped: themes don't need them.
 */
export function yaml(text: string): Map<string, string> {
  const values = new Map<string, string>();
  const parents: { indent: number; key: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = uncomment(raw, "#").trimEnd();
    const match = /^(\s*)([^\s:#-][^:]*?|"[^"]*"|'[^']*'):(?:\s+(.*))?$/.exec(line);
    if (!match) continue;
    const indent = match[1].length;
    while (parents.length && parents.at(-1)!.indent >= indent) parents.pop();
    const key = [...parents.map((parent) => parent.key), unquote(match[2])].join(".");
    if (match[3]) values.set(key, unquote(match[3]));
    else parents.push({ indent, key: unquote(match[2]) });
  }
  return values;
}

/** A TOML value: a string, a number or true and false as text, or an array of them. */
function tomlValue(value: string): string | string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    return [...trimmed.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'/g)].map((item) => item[1] ?? item[2]);
  }
  return unquote(trimmed);
}

/** TOML's tables and keys, flattened to dotted keys (`colors.primary.background`); inline tables too. */
export function toml(text: string): Map<string, string | string[]> {
  const values = new Map<string, string | string[]>();
  let table = "";
  // Arrays can run over several lines: join them up first.
  const lines = text.split(/\r?\n/).map((line) => uncomment(line, "#").trim());
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    while (/=\s*\[[^\]]*$/.test(line) && i + 1 < lines.length) line += " " + lines[++i];
    const header = /^\[\s*([^\]]+?)\s*\]$/.exec(line);
    if (header) {
      table = header[1].replace(/["']/g, "");
      continue;
    }
    const pair = /^([\w."'-]+)\s*=\s*(.+)$/.exec(line);
    if (!pair) continue;
    const key = [table, pair[1].replace(/["']/g, "")].filter(Boolean).join(".");
    const inline = /^\{(.*)\}$/.exec(pair[2].trim());
    if (inline) {
      for (const entry of inline[1].matchAll(/([\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^,]+)/g)) values.set(`${key}.${entry[1]}`, tomlValue(entry[2]));
    } else {
      values.set(key, tomlValue(pair[2]));
    }
  }
  return values;
}

/** INI's sections of keys, `[Colors:View]` then `BackgroundNormal=…`; keys before any section are in "". */
export function ini(text: string): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>([["", new Map()]]);
  let section = sections.get("")!;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      section = sections.get(header[1]) ?? new Map();
      sections.set(header[1], section);
      continue;
    }
    const pair = /^([^=]+?)\s*=\s*(.*)$/.exec(line);
    if (pair) section.set(pair[1], unquote(pair[2]));
  }
  return sections;
}

/** Lines of `key value` (Kitty's) or `key = value` (Ghostty's), in order. Comments take whole lines, so `#` starts a color. */
export function keyValues(text: string, separator: "space" | "=") {
  const pattern = separator === "=" ? /^([\w.-]+)\s*=\s*(.*)$/ : /^([\w.-]+)\s+(.*)$/;
  return text.split(/\r?\n/).flatMap((raw) => {
    const match = pattern.exec(raw.trim());
    return match ? [[match[1], unquote(match[2])] as const] : [];
  });
}

export type Plist = string | number | boolean | Plist[] | { [key: string]: Plist };

/** An Apple property list (TextMate's and iTerm2's themes), or null. */
export function plist(text: string): Plist | null {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) return null;
  const read = (element: Element): Plist => {
    switch (element.tagName) {
      case "dict": {
        const dict: Record<string, Plist> = {};
        const children = [...element.children];
        for (let i = 0; i + 1 < children.length; i += 2) dict[children[i].textContent ?? ""] = read(children[i + 1]);
        return dict;
      }
      case "array":
        return [...element.children].map(read);
      case "real":
      case "integer":
        return Number(element.textContent);
      case "true":
        return true;
      case "false":
        return false;
      default:
        return element.textContent ?? "";
    }
  };
  const root = document.documentElement.tagName === "plist" ? document.documentElement.firstElementChild : document.documentElement;
  return root ? read(root) : null;
}

/** A file's name without its extension, for themes whose files don't name them: `Dracula` for `Dracula.itermcolors`. */
export const baseName = (fileName: string) =>
  fileName
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/_/g, " ")
    .trim() || fileName;
