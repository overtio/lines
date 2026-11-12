import { hex, mix, type Rgb } from "../../../src/lib/themes/color";
import type { ThemeFile } from "../../../src/lib/themes/file";
import { alpha, brighter, type Colors, hues, ramp, resolve } from "../colors";
import { SCHEMES, slug, type Written } from "./common";

/*
 * A VS Code extension with the theme's light and dark versions: copy its folder into
 * ~/.vscode/extensions, or package it with `vsce package`. The workbench takes lines' panes (the
 * sidebar for the side bar and activity bar, the note list's for panels and tabs, the note's for
 * the editor), and code its colors.
 */

function workbench(get: Colors, dark: boolean): Record<string, string> {
  const [bg, list, sidebar, elevated, text, accent, ink] = ["bg", "bg-list", "bg-sidebar", "bg-elevated", "text", "accent", "ink"].map(get);
  const [sidebarText, muted, faint, onAccent, danger, success, warning, info] = ["text-sidebar", "text-muted", "text-faint", "on-accent", "danger", "success", "callout-warning", "callout-info"].map((name) => hex(get(name)));
  const border = alpha(ink, dark ? 0.09 : 0.1);
  const hover = alpha(ink, dark ? 0.06 : 0.05);
  const selection = alpha(accent, dark ? 0.3 : 0.22);
  const ansi = hues(get);
  const { neutrals } = ramp(get);
  const terminal = (name: string, color: Rgb) => ({ [`terminal.ansi${name}`]: hex(color), [`terminal.ansiBright${name}`]: hex(brighter(color)) });
  return {
    foreground: hex(text),
    descriptionForeground: muted,
    disabledForeground: faint,
    errorForeground: danger,
    focusBorder: hex(accent),
    "widget.border": border,
    "widget.shadow": alpha({ r: 0, g: 0, b: 0, a: 1 }, dark ? 0.4 : 0.12),
    "selection.background": selection,
    "textLink.foreground": hex(accent),
    "textLink.activeForeground": hex(accent),
    "textBlockQuote.border": hex(accent),
    "textCodeBlock.background": alpha(ink, 0.05),
    "textPreformat.foreground": hex(text),
    "icon.foreground": muted,
    "scrollbarSlider.background": alpha(ink, 0.12),
    "scrollbarSlider.hoverBackground": alpha(ink, 0.2),
    "scrollbarSlider.activeBackground": alpha(ink, 0.28),
    "button.background": hex(accent),
    "button.foreground": onAccent,
    "button.hoverBackground": hex(mix(accent, text, 0.12)),
    "button.secondaryBackground": alpha(ink, 0.08),
    "button.secondaryForeground": hex(text),
    "button.secondaryHoverBackground": alpha(ink, 0.12),
    "badge.background": hex(accent),
    "badge.foreground": onAccent,
    "activityBarBadge.background": hex(accent),
    "activityBarBadge.foreground": onAccent,
    "progressBar.background": hex(accent),
    "input.background": hex(elevated),
    "input.foreground": hex(text),
    "input.border": border,
    "input.placeholderForeground": faint,
    "inputOption.activeBorder": hex(accent),
    "inputOption.activeBackground": selection,
    "checkbox.background": hex(elevated),
    "checkbox.border": border,
    "dropdown.background": hex(elevated),
    "dropdown.border": border,
    "dropdown.foreground": hex(text),
    "menu.background": hex(elevated),
    "menu.foreground": hex(text),
    "menu.selectionBackground": selection,
    "menu.selectionForeground": hex(text),
    "menu.separatorBackground": border,
    "menu.border": border,
    "quickInput.background": hex(elevated),
    "quickInput.foreground": hex(text),
    "quickInputList.focusBackground": selection,
    "quickInputList.focusForeground": hex(text),
    "editorWidget.background": hex(elevated),
    "editorWidget.border": border,
    "editorSuggestWidget.background": hex(elevated),
    "editorSuggestWidget.border": border,
    "editorSuggestWidget.selectedBackground": selection,
    "editorHoverWidget.background": hex(elevated),
    "editorHoverWidget.border": border,
    "notifications.background": hex(elevated),
    "notifications.border": border,
    "list.activeSelectionBackground": selection,
    "list.activeSelectionForeground": hex(text),
    "list.inactiveSelectionBackground": alpha(ink, 0.08),
    "list.hoverBackground": hover,
    "list.focusOutline": hex(accent),
    "list.highlightForeground": hex(accent),
    "list.errorForeground": danger,
    "list.warningForeground": warning,
    "activityBar.background": hex(sidebar),
    "activityBar.foreground": hex(text),
    "activityBar.inactiveForeground": faint,
    "activityBar.activeBorder": hex(accent),
    "activityBar.border": border,
    "sideBar.background": hex(sidebar),
    "sideBar.foreground": sidebarText,
    "sideBar.border": border,
    "sideBarTitle.foreground": muted,
    "sideBarSectionHeader.background": hex(sidebar),
    "sideBarSectionHeader.foreground": muted,
    "sideBarSectionHeader.border": border,
    "titleBar.activeBackground": hex(sidebar),
    "titleBar.activeForeground": hex(text),
    "titleBar.inactiveBackground": hex(sidebar),
    "titleBar.inactiveForeground": faint,
    "titleBar.border": border,
    "statusBar.background": hex(sidebar),
    "statusBar.foreground": muted,
    "statusBar.border": border,
    "statusBar.noFolderBackground": hex(sidebar),
    "statusBar.debuggingBackground": hex(accent),
    "statusBar.debuggingForeground": onAccent,
    "statusBarItem.remoteBackground": hex(accent),
    "statusBarItem.remoteForeground": onAccent,
    "statusBarItem.hoverBackground": hover,
    "panel.background": hex(list),
    "panel.border": border,
    "panelTitle.activeForeground": hex(text),
    "panelTitle.inactiveForeground": faint,
    "panelTitle.activeBorder": hex(accent),
    "editorGroup.border": border,
    "editorGroupHeader.tabsBackground": hex(list),
    "editorGroupHeader.tabsBorder": border,
    "tab.activeBackground": hex(bg),
    "tab.activeForeground": hex(text),
    "tab.activeBorderTop": hex(accent),
    "tab.inactiveBackground": hex(list),
    "tab.inactiveForeground": faint,
    "tab.hoverBackground": hover,
    "tab.border": border,
    "breadcrumb.foreground": faint,
    "breadcrumb.focusForeground": hex(text),
    "breadcrumb.background": hex(bg),
    "editor.background": hex(bg),
    "editor.foreground": hex(text),
    "editorLineNumber.foreground": faint,
    "editorLineNumber.activeForeground": muted,
    "editorCursor.foreground": hex(accent),
    "editor.selectionBackground": selection,
    "editor.inactiveSelectionBackground": alpha(accent, dark ? 0.16 : 0.12),
    "editor.selectionHighlightBackground": alpha(accent, 0.12),
    "editor.wordHighlightBackground": alpha(ink, 0.08),
    "editor.findMatchBackground": alpha(get("highlight-base"), dark ? 0.4 : 0.55),
    "editor.findMatchHighlightBackground": alpha(get("highlight-base"), dark ? 0.2 : 0.3),
    "editor.lineHighlightBackground": alpha(ink, dark ? 0.04 : 0.035),
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background1": alpha(ink, 0.07),
    "editorIndentGuide.activeBackground1": alpha(ink, 0.18),
    "editorWhitespace.foreground": alpha(ink, 0.18),
    "editorRuler.foreground": border,
    "editorBracketMatch.background": alpha(accent, 0.15),
    "editorBracketMatch.border": alpha(accent, 0.5),
    "editorLink.activeForeground": hex(accent),
    "editorError.foreground": danger,
    "editorWarning.foreground": warning,
    "editorInfo.foreground": info,
    "editorGutter.addedBackground": success,
    "editorGutter.modifiedBackground": info,
    "editorGutter.deletedBackground": danger,
    "diffEditor.insertedTextBackground": alpha(get("success"), 0.14),
    "diffEditor.removedTextBackground": alpha(get("danger"), 0.14),
    "gitDecoration.addedResourceForeground": success,
    "gitDecoration.untrackedResourceForeground": success,
    "gitDecoration.modifiedResourceForeground": warning,
    "gitDecoration.deletedResourceForeground": danger,
    "gitDecoration.ignoredResourceForeground": faint,
    "terminal.background": hex(bg),
    "terminal.foreground": hex(text),
    "terminalCursor.foreground": hex(accent),
    ...terminal("Black", neutrals[dark ? 2 : 7]),
    ...terminal("Red", ansi.red),
    ...terminal("Green", ansi.green),
    ...terminal("Yellow", ansi.yellow),
    ...terminal("Blue", ansi.blue),
    ...terminal("Magenta", ansi.magenta),
    ...terminal("Cyan", ansi.cyan),
    ...terminal("White", neutrals[dark ? 5 : 3]),
  };
}

/** Code's colors by TextMate scope, which VS Code's grammars give their tokens. */
function tokens(get: Colors) {
  const color = (name: string) => hex(get(name));
  const rule = (name: string, scope: string[], foreground: string, fontStyle?: string) => ({ name, scope, settings: { foreground, ...(fontStyle && { fontStyle }) } });
  return [
    rule("Comments", ["comment", "punctuation.definition.comment", "string.comment"], color("syn-comment"), "italic"),
    rule("Keywords", ["keyword", "storage", "storage.modifier", "keyword.control", "keyword.operator.new", "keyword.operator.expression"], color("syn-keyword")),
    rule("Strings", ["string", "string.template", "markup.inline.raw", "constant.other.symbol"], color("syn-string")),
    rule("Numbers and constants", ["constant.numeric", "constant.language", "constant.character", "support.constant", "variable.other.constant"], color("syn-number")),
    rule("Functions", ["entity.name.function", "support.function", "meta.function-call", "variable.function"], color("syn-function")),
    rule("Types", ["entity.name.type", "entity.name.class", "support.type", "support.class", "storage.type", "entity.other.inherited-class"], color("syn-type")),
    rule("Tags", ["entity.name.tag", "meta.tag.sgml"], color("syn-keyword")),
    rule("Attributes", ["entity.other.attribute-name"], color("syn-function")),
    rule("Variables", ["variable", "meta.definition.variable", "variable.other.readwrite"], color("text")),
    rule("Punctuation", ["punctuation", "meta.brace", "keyword.operator"], color("text-muted")),
    rule("Headings", ["markup.heading", "entity.name.section"], color("accent"), "bold"),
    rule("Bold", ["markup.bold"], color("text"), "bold"),
    rule("Italic", ["markup.italic"], color("text"), "italic"),
    rule("Links", ["markup.underline.link", "string.other.link"], color("accent")),
    rule("Quotes", ["markup.quote"], color("text-muted"), "italic"),
    rule("Inserted", ["markup.inserted"], color("success")),
    rule("Deleted", ["markup.deleted", "invalid"], color("danger")),
  ];
}

const semantic = (get: Colors) => ({
  function: hex(get("syn-function")),
  method: hex(get("syn-function")),
  type: hex(get("syn-type")),
  class: hex(get("syn-type")),
  interface: hex(get("syn-type")),
  enum: hex(get("syn-type")),
  keyword: hex(get("syn-keyword")),
  string: hex(get("syn-string")),
  number: hex(get("syn-number")),
  comment: { foreground: hex(get("syn-comment")), italic: true },
  variable: hex(get("text")),
  parameter: hex(get("text")),
  property: hex(get("text")),
  "variable.readonly": hex(get("syn-number")),
});

export function vscode(theme: ThemeFile): Written {
  const id = slug(theme.name);
  const schemes = SCHEMES.filter((scheme) => theme[scheme]);
  const label = (scheme: string) => (schemes.length > 1 ? `${theme.name} ${scheme === "dark" ? "Dark" : "Light"}` : theme.name);
  const files: Written = {};
  for (const scheme of schemes) {
    const get = resolve(theme[scheme]!, scheme);
    const dark = scheme === "dark";
    files[`themes/${id}-${scheme}-color-theme.json`] = {
      $schema: "vscode://schemas/color-theme",
      name: label(scheme),
      ...(theme.author && { author: theme.author }),
      type: scheme,
      semanticHighlighting: true,
      colors: workbench(get, dark),
      tokenColors: tokens(get),
      semanticTokenColors: semantic(get),
    };
  }
  files["package.json"] = {
    name: `${id}-theme`,
    displayName: theme.name,
    description: `The ${theme.name} theme, made with lines' theme tools.`,
    version: "1.0.0",
    publisher: "lines",
    engines: { vscode: "^1.70.0" },
    categories: ["Themes"],
    contributes: {
      themes: schemes.map((scheme) => ({ label: label(scheme), uiTheme: scheme === "dark" ? "vs-dark" : "vs", path: `./themes/${id}-${scheme}-color-theme.json` })),
    },
  };
  return files;
}
