import type { ImportedTheme, ThemeFormat } from "../../../lib/plugins/types";

/*
 * The theme files of other apps lines reads, for Settings → Theme → Import. Each reader loads
 * the first time a file is read, so they cost nothing until then.
 */

type Reader = (text: string, fileName: string) => ImportedTheme[];

const format = (id: string, name: string, extensions: string[], load: () => Promise<Reader>): ThemeFormat => ({
  id,
  name,
  extensions,
  read: async (text, fileName) => (await load())(text, fileName),
});

const editors = () => import("./editors");
const terminals = () => import("./terminals");
const desktops = () => import("./desktops");

export const formats = (): ThemeFormat[] => [
  format("vscode", "VS Code", ["json", "jsonc"], async () => (await editors()).vscode),
  format("zed", "Zed", ["json"], async () => (await editors()).zed),
  format("textmate", "TextMate", ["tmtheme"], async () => (await editors()).textmate),
  format("base16", "Base16", ["yaml", "yml"], async () => (await desktops()).base16),
  format("kde", "KDE Plasma", ["colors"], async () => (await desktops()).kde),
  format("gtk", "GTK", ["css"], async () => (await desktops()).gtk),
  format("iterm", "iTerm2", ["itermcolors"], async () => (await terminals()).iterm),
  format("alacritty", "Alacritty", ["toml", "yaml", "yml"], async () => (await terminals()).alacritty),
  format("kitty", "Kitty", ["conf"], async () => (await terminals()).kitty),
  format("ghostty", "Ghostty", [], async () => (await terminals()).ghostty),
  format("wezterm", "WezTerm", ["toml"], async () => (await terminals()).wezterm),
  format("windows-terminal", "Windows Terminal", ["json"], async () => (await terminals()).windowsTerminal),
  format("foot", "foot", ["ini"], async () => (await terminals()).foot),
  format("konsole", "Konsole", ["colorscheme"], async () => (await terminals()).konsole),
  format("xresources", "Xresources", ["xresources", "xdefaults"], async () => (await terminals()).xresources),
  format("pywal", "pywal", ["json"], async () => (await terminals()).pywal),
];
