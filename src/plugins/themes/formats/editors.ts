import { colorful } from "../../../lib/themes/palette";
import type { ImportedColors, ImportedTheme } from "../../../lib/plugins/types";
import { baseName, jsonc, plist } from "./parse";

/* Code editors' themes: VS Code's, Zed's, and TextMate's (Sublime Text, bat). */

type Strings = Record<string, string | undefined>;

interface TokenRule {
  scope?: string | string[];
  settings?: {
    foreground?: string;
    background?: string;
    [setting: string]: unknown;
  };
}

/** The scopes code is highlighted by, in the order they're looked for, for each of lines' code colors. */
const SCOPES: Record<keyof NonNullable<ImportedColors["syntax"]>, string[]> = {
  keyword: ["keyword", "keyword.control", "storage.type", "storage"],
  string: ["string", "string.quoted"],
  number: ["constant.numeric", "constant"],
  comment: ["comment", "punctuation.definition.comment"],
  function: ["entity.name.function", "support.function", "meta.function-call"],
  type: ["entity.name.type", "entity.name.class", "support.type", "support.class", "storage.type"],
};

/** Code's colors from TextMate's rules (which VS Code's `tokenColors` are): the last rule naming a scope wins, as in TextMate. */
function syntaxOf(rules: TokenRule[]): ImportedColors["syntax"] {
  const colors = new Map<string, string>();
  for (const rule of rules) {
    const scopes = typeof rule.scope === "string" ? rule.scope.split(",") : (rule.scope ?? []);
    const foreground = rule.settings?.foreground;
    if (typeof foreground !== "string") continue;
    for (const scope of scopes) colors.set(scope.trim(), foreground);
  }
  return Object.fromEntries(
    Object.entries(SCOPES).flatMap(([kind, scopes]) => {
      const found = scopes.map((scope) => colors.get(scope)).find(Boolean);
      return found ? [[kind, found]] : [];
    }),
  );
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** A VS Code color theme (`*-color-theme.json`, or what Developer: Generate Color Theme From Current Settings writes). */
export function vscode(text: string, fileName: string): ImportedTheme[] {
  const theme = jsonc(text);
  if (!isObject(theme) || (!isObject(theme.colors) && !Array.isArray(theme.tokenColors))) return [];
  const colors = (isObject(theme.colors) ? theme.colors : {}) as Strings;
  const rules = (Array.isArray(theme.tokenColors) ? theme.tokenColors : []) as TokenRule[];
  // TextMate's way: the rule without a scope has the editor's own colors.
  const editor = rules.find((rule) => !rule.scope)?.settings ?? {};
  const background = colors["editor.background"] ?? editor.background;
  const foreground = colors["editor.foreground"] ?? colors.foreground ?? editor.foreground;
  if (!background || !foreground) return [];
  return [
    {
      name: typeof theme.name === "string" ? theme.name : baseName(fileName),
      author: typeof theme.author === "string" ? theme.author : undefined,
      colors: {
        background,
        foreground,
        sidebar: colors["sideBar.background"] ?? colors["activityBar.background"],
        sidebarForeground: colors["sideBar.foreground"],
        elevated: colors["menu.background"] ?? colors["editorWidget.background"],
        muted: colors.descriptionForeground,
        faint: colors["editorLineNumber.foreground"] ?? colors["input.placeholderForeground"],
        accent: colorful(
          [
            colors["button.background"],
            colors.focusBorder,
            colors["textLink.foreground"],
            colors["activityBarBadge.background"],
            colors["progressBar.background"],
          ],
          background,
        ),
        danger: colors.errorForeground ?? colors["editorError.foreground"],
        success: colors["gitDecoration.addedResourceForeground"],
        warning: colors["editorWarning.foreground"],
        info: colors["editorInfo.foreground"],
        hues: {
          red: colors["terminal.ansiRed"],
          yellow: colors["terminal.ansiYellow"],
          green: colors["terminal.ansiGreen"],
          cyan: colors["terminal.ansiCyan"],
          blue: colors["terminal.ansiBlue"],
          magenta: colors["terminal.ansiMagenta"],
        },
        syntax: syntaxOf(rules),
      },
    },
  ];
}

/** A Zed theme family: several themes in one file, usually a light and a dark one. */
export function zed(text: string): ImportedTheme[] {
  const family = jsonc(text);
  if (!isObject(family) || !Array.isArray(family.themes)) return [];
  const author = typeof family.author === "string" ? family.author : undefined;
  return family.themes.flatMap((theme: unknown) => {
    if (!isObject(theme) || !isObject(theme.style) || typeof theme.name !== "string") return [];
    const style = theme.style as Strings & {
      syntax?: Record<string, { color?: string } | undefined>;
      players?: { cursor?: string }[];
    };
    const background = style["editor.background"] ?? style.background;
    const foreground = style.text ?? style["editor.foreground"];
    if (!background || !foreground) return [];
    const ansi = (hue: string) => style[`terminal.ansi.${hue}`];
    const syntax = (kind: string) => style.syntax?.[kind]?.color ?? undefined;
    return [
      {
        name: theme.name,
        author,
        colors: {
          background,
          foreground,
          sidebar: style["panel.background"] ?? style["surface.background"],
          elevated: style["elevated_surface.background"],
          muted: style["text.muted"],
          faint: style["text.placeholder"],
          accent: style["text.accent"] ?? style["icon.accent"] ?? style.players?.[0]?.cursor,
          danger: style.error,
          success: style.success ?? style.created,
          warning: style.warning,
          info: style.info,
          hues: {
            red: ansi("red"),
            yellow: ansi("yellow"),
            green: ansi("green"),
            cyan: ansi("cyan"),
            blue: ansi("blue"),
            magenta: ansi("magenta"),
          },
          syntax: {
            keyword: syntax("keyword"),
            string: syntax("string"),
            number: syntax("number"),
            comment: syntax("comment"),
            function: syntax("function"),
            type: syntax("type"),
          },
        },
      },
    ];
  });
}

/** A TextMate theme (`.tmTheme`), as Sublime Text, bat and many other tools read them. */
export function textmate(text: string, fileName: string): ImportedTheme[] {
  const theme = plist(text);
  if (!isObject(theme) || !Array.isArray(theme.settings)) return [];
  const rules = theme.settings as TokenRule[];
  const editor = rules.find((rule) => !rule.scope)?.settings ?? {};
  const { background, foreground } = editor;
  if (typeof background !== "string" || typeof foreground !== "string") return [];
  const syntax = syntaxOf(rules);
  return [
    {
      name: typeof theme.name === "string" ? theme.name : baseName(fileName),
      author: typeof theme.author === "string" ? theme.author : undefined,
      colors: {
        background,
        foreground,
        faint: syntax?.comment,
        accent: colorful([editor.caret as string, syntax?.function, syntax?.keyword], background),
        syntax,
      },
    },
  ];
}
