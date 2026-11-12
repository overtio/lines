# Theme tools

Two small command-line tools in `tools/themes/`, beside lines for now (they may become a project of their own):

- **swatch** reads pictures and videos and keeps their colors: 16 of them, or as many as you ask for.
- **adapt-theme** makes themes of a swatch, or of a lines theme, for other apps: lines itself, VS Code, GTK and Base24 (and from that, the hundreds of apps Base16's templates theme).

lines' Green World theme was made with them, from SkyeWei's animation [Green World](https://youtu.be/MkxgDkH1rto): the swatch first, then the theme from it, its colors then tuned by hand.

They run with [Bun](https://bun.com) from the repository, after `bun install`. **swatch** needs [ffmpeg](https://ffmpeg.org) (`brew install ffmpeg`, or your system's package), and [yt-dlp](https://github.com/yt-dlp/yt-dlp) for links to video pages.

## swatch

```sh
bun run swatch <picture, video or link>… [options]
```

| Option | |
| --- | --- |
| `-n`, `--colors <n>` | How many colors: 16 to begin with, 2 or more |
| `-f`, `--frames <n>` | How many frames are read, spread evenly through a video: 120 to begin with |
| `--name <name>` | The swatch's name: otherwise the video's title, for a link, or the first file's name |
| `-o`, `--out <folder>` | Where its files go: the folder you're in to begin with |

It reads any picture or video ffmpeg does (PNG, JPEG, WebP, AVIF, an animated GIF, MP4, MOV, WebM…), a link straight to one, or a link to a page with a video on it (YouTube, Vimeo, and the rest yt-dlp knows), which it fetches at the smallest size it can, only to read its colors, and doesn't keep. Several at once make one swatch of all of them.

```sh
bun run swatch https://youtu.be/MkxgDkH1rto --name "Green World"
bun run swatch lake.jpg dawn.jpg --colors 24 --out swatches
```

It writes three files, named after the swatch:

- `green-world.swatch.json`, its colors, most plentiful first, each with its share of the pixels, what **adapt-theme** reads.
- `green-world.gpl`, a GIMP palette, which GIMP, Inkscape, Krita and Aseprite open.
- `green-world.svg`, a picture of it: a band of the colors as wide as their shares, and each color with its hex.

### How the colors are picked

Frames are read small (96 pixels on their longest side), which is all their colors need. Their pixels are grouped by how alike they look (k-means in OKLab, the same as Settings → Theme → New → From a Picture… does, in `src/lib/themes/swatches.ts`), finely, into three times as many groups as colors asked for, and at least 48. The colors are then picked from those one at a time: each time the one that's plentiful, vivid and least like those picked already. So a small bright patch, a glowing leaf in a dark scene, makes it in beside the wide washes of color, and two nearly alike don't both. The groups not picked go to the color nearest them, which gives each its share.

## adapt-theme

```sh
bun run adapt-theme <file.swatch.json | file.lines-theme.json> [options]
```

| Option | |
| --- | --- |
| `-t`, `--to <targets>` | Which, by commas: `lines`, `vscode`, `gtk`, `base24`. All of them to begin with |
| `--name <name>` | The theme's name: otherwise the file's |
| `-o`, `--out <folder>` | Where they go: a folder named after the theme to begin with, with one inside for each target |

A **swatch** makes a theme as Settings → Theme → New → From a Picture… does ([themes.md](themes.md#your-own-themes)), light and dark: the main color tints the backgrounds, the most vivid plentiful one is the accent, and colors near red, green, blue and the rest color callouts and code, all made to read. A **lines theme file** is used as it is: download one of yours from the share button beside its name in Settings → Theme (for one of lines' own, make yours from it first with **New**), so any theme can go to other apps; to tune a swatch's theme by hand, make the lines theme first, open it in lines with Import, change it there, and download it again.

Colors a lines theme leaves out (most leave out the callouts' and code's) are lines' own, from `src/app.css`, as the app shows them.

### What it writes

| Target | Files | To use it |
| --- | --- | --- |
| `lines` | `Green World.lines-theme.json` | Settings → Theme → Import → Choose a File… |
| `vscode` | An extension: `package.json` and `themes/`, with a light and a dark theme | Copy the folder into `~/.vscode/extensions/`, or make a `.vsix` of it with `vsce package`, then choose the theme with **Preferences: Color Theme** |
| `gtk` | `gtk-4.0/gtk.css`, and `gtk-3.0/light.css` and `dark.css` | For GNOME's apps (libadwaita 1.6 or later), copy `gtk-4.0/gtk.css` to `~/.config/gtk-4.0/`: its dark colors are used while the system's style is dark. For GTK 3 apps with the adw-gtk3 theme, copy `light.css` or `dark.css` to `~/.config/gtk-3.0/gtk.css` |
| `base24` | `green-world-light.yaml`, `green-world-dark.yaml` | With [tinty](https://github.com/tinted-theming/tinty), Stylix or flavours, or any Base16 template, for terminals, editors and window managers |

How lines' colors are given to each:

- **VS Code**: the note's background is the editor's, the note list's the panels' and tabs', the sidebar's the side bar's, activity bar's, title bar's and status bar's, and menus' the widgets', menus' and inputs'. The accent is buttons, links, badges, focus and the cursor; the selection and borders are mixed from it and the theme's ink, as lines mixes them. Code's colors go to TextMate's scopes and to semantic tokens; danger, success and the callouts to errors, warnings, git and the terminal.
- **GTK**: libadwaita's named colors: the note's background for views, the note list's for windows and header bars, the sidebar's for sidebars, menus' for popovers, dialogs and cards; the accent, and danger, success and the pin's color for libadwaita's destructive, success and warning colors, with the text that goes on them. GTK 3's older names (`theme_bg_color`…) too.
- **Base24**: `base00` to `base07` go from the background to the text and past it (the sidebar, a selection, faint text for comments, secondary text), `base08` to `base0F` are red, orange, yellow, green, cyan, blue, magenta and brown, from danger, the pin, highlights, success and the callouts, each at least 3:1 on the background; `base10` and `base11` are darker backgrounds, and `base12` to `base17` the bright hues. Base16 and Base24 have no accent of their own, so a theme whose accent isn't blue loses it there (`base0D`, blue, is what Base16's templates use).

What lines writes reads back in lines (Import), which is how its tests check them (`tests/unit/themeTools.test.ts`).
