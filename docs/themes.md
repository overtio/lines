# Themes

lines comes with twenty-three themes, each light and dark, and styles that change the whole look beyond the colors: a 90s desktop, one-bit pixels, neon. You can also make your own themes, share them as a file, and import themes made for other apps: VS Code, Zed, Base16, your terminal or your Linux desktop.

Everything here is in Settings → Theme.

## Your own themes

**New → From** the theme chosen makes a copy of it, under **Your themes**, and opens it to change below Light or dark, Contrast and Icons: its name, and its colors.

**New → From a Picture…** makes one from a picture's colors, a wallpaper or a photo, named after it, light and dark. The picture is read on this device, nothing is sent anywhere: its colors are grouped, its main tone tints the backgrounds (more of it the more colorful the picture, less in light, where a little goes a long way), its most vivid color that's also plentiful becomes the accent, and colors near red, green, blue and the rest color the callouts and code. The text reads at least 7:1 on the background, grey text 5:1 and the accent 4.5:1; a picture without color makes a theme in greys. **Use the Picture as the Backdrop** then puts it behind the page (Settings → Paper → Backdrop). Like any of your themes, it can be changed color by color after.

- **Colors for** Light or Dark chooses which of its two sets of colors you're changing. The preview above the colors shows that set, as the sidebar, the note list and a note with a tag, a link, code and a callout; lines itself shows the set Light or dark asks for, as you change it.
- Each color has a swatch, which opens your system's color picker, and its value as text, where you can type or paste any color CSS reads (`#7c3aed`, `rgb(124 58 237)`, `oklch(55% 0.2 290)`).
- **Backgrounds, Text and Accent** are the colors every theme has. Borders, hovers, the selection, chips behind tags and code's background are mixed from them, the way lines' own themes work theirs out.
- **More Colors** has the ones a theme can leave to lines: danger, success, pinned and highlights, the five callouts, and code. Left empty (Auto), they're lines' own, and the swatch shows what that is; the arrow beside one empties it again.
- **Delete** asks first, then shows Lines in its place.

Your themes are kept on this device, like the rest of Settings, and change in every window at once (Settings, floating notes) as you edit them. They don't sync between devices yet; share one as a file to have it on another.

### Themes with only light or dark colors

Most themes made for other apps are one or the other: Dracula is dark, Solarized Light is light. Imported, such a theme says **Dark colors only**, and lines is dark with it whatever Light or dark says (Light or dark says so too).

**Make Light Colors** (or Make Dark Colors) works out the other set from the one it has: its backgrounds and text keep their tint at the lightness lines' own theme has there, and its accent, status, callout and code colors keep their hue, made light or dark enough to read on the new background. It's a start; change any of it after.

### Increased contrast

Settings → Theme → Contrast → Increased works with your themes as with lines' own: their grey text, faint text, accent and tags are darkened (lightened in dark) until they reach the same contrast lines' themes do ([accessibility.md](accessibility.md)). lines works these out from your theme's colors each time they change, so there's nothing to set. A color written in a way lines can't read itself (`oklch()`, `var()`) is left as it is.

## Styles

A theme is colors. A style is the rest of the look: how round the corners are, the type, the lines and shadows, and what makes it itself. Settings → Theme → Style has four:

- **Lines**: soft corners, quiet shadows and your system's font, as lines has always looked.
- **Classic**: a desktop of the late 90s. Raised and sunken bevels lit from the top left, a title bar with a gradient over the note list, the selection in the accent, square corners, Tahoma, scroll bars with arrow buttons.
- **Pixel**: one-bit and minimal. A pixel font (Pixelify Sans, with VT323 for code), 2px lines, hard shadows a pressed button drops, what's chosen turned around, square everything, and no easing.
- **Neon**: a city at night. Lines and text that glow in the accent and the tags' color, a faint grid behind the note and scan lines over everything, headings in a wide display face (Orbitron), buttons with their corners cut.

Each but Lines comes with a color theme made for it (Classic, Pixel and Neon, in the Themes list too), chosen with it. Any other theme can be chosen after, and the style keeps its shapes in those colors: its bevels, lines and glows are made from the theme's own colors. Choosing another style while a style's colors still show goes back to Lines' colors. A style that has its own font is notes' first font in Settings → Typography too, in place of the system's; the other fonts there still work with it.

Styles are plugins (the Styles plugin has these three), and a plugin can add more: what one can set, and how it reaches each part of the app, is in [plugins.md](plugins.md#what-a-plugin-can-add). Neon's glow and scan lines go with Increased contrast, and its grid while a paper is chosen. Styles change how lines looks, not what it prints: a note's PDF is black on white in every style.

## Dark panes

Settings → Theme → **Dark panes** shows the sidebar, the note list or both in the theme's dark colors while lines is light, so the note is a light page beside dark panes. It works with every theme: the panes take the theme's own dark colors (for a theme with light colors only, ones worked out from them as Make Dark Colors does), Increased contrast's too, and Monochrome and Invert change them as they do the rest of the window. A style keeps its shapes in them: Classic's bevels, Pixel's lines and Neon's glow are made from the panes' colors there. While lines is dark, the panes are dark anyway, and there's nothing for it to change. The theme picker's swatches show the sidebar dark while it's on.

## Monochrome and Invert

Two switches in Settings → Theme change whatever theme is chosen, yours or lines' own:

- **Monochrome** shows every color of the theme as a grey: the accent, tags, links, callouts, code, everything. Each grey is exactly as light as its color was (to WCAG's measure), so every bit of text has the contrast it had.
- **Invert** turns the theme around, light for dark: a light theme becomes a dark one (white becomes black), a dark one light. Each color keeps its hue, and its lightness is mirrored so that any two colors are as far apart as before (each color's luminance plus 0.05 becomes 0.0525 divided by it): what read at 7:1 still reads at 7:1. Light or dark chooses which of the theme's colors are turned. Highlights stay bright, as they are in lines' dark themes.

Both together give the theme in greys, turned. They apply on top of Increased contrast, in every window, and to diagrams, 3D models and recordings, which take the theme's colors. Pictures, and drawings' own pen colors, stay as they are. The theme picker's swatches and your theme's editor show the theme's own colors.

## Sharing a theme

The share button beside your theme's name:

- **Share…** sends the theme's file through your system's share sheet (AirDrop, Messages, Mail…), where there is one.
- **Copy Theme** copies the file's text, to paste into a message.
- **Download Theme File** saves it: `Dracula.lines-theme.json`.

Whoever gets it adds it with **Import → Choose a File…**, or **Import → Paste a Theme…** for text they copied. Themes of other apps are imported the same way, and several files can be chosen at once.

## lines' theme files

A lines theme file is JSON: the theme's name, who made it if you like, and its colors for light, dark or both, by the names of app.css's custom properties without their `--`:

```json
{
  "name": "Dracula",
  "author": "Zeno Rocha",
  "dark": {
    "bg": "#282a36",
    "bg-list": "#2d2f3b",
    "bg-sidebar": "#21222c",
    "bg-elevated": "#343746",
    "text": "#f8f8f2",
    "text-sidebar": "#e2e2dc",
    "text-muted": "#a9aaab",
    "text-faint": "#6272a4",
    "accent": "#bd93f9",
    "tag-text": "#bd93f9",
    "ink": "#f8f8f2",
    "syn-keyword": "#ff79c6",
    "syn-string": "#f1fa8c"
  }
}
```

| Colors | What they are |
|---|---|
| `bg`, `bg-list`, `bg-sidebar`, `bg-elevated` | The note's background, the note list's, the sidebar's, and menus' and dialogs' |
| `text`, `text-sidebar`, `text-muted`, `text-faint` | Text, the sidebar's, secondary (previews, notes in Settings) and faint (dates, counts, hints) |
| `accent`, `tag-text` | Links, buttons and what's chosen; tags |
| `ink` | What borders, hovers and code's background are mixed from: usually the text color |
| `danger`, `success`, `pin`, `highlight-base` | Optional: deleting and errors, success, pinned notes, highlights |
| `callout-info`, `callout-question`, `callout-warning`, `callout-error`, `callout-decision` | Optional: the callouts |
| `syn-keyword`, `syn-string`, `syn-number`, `syn-comment`, `syn-function`, `syn-type` | Optional: code |
| `on-accent`, `on-danger`, `on-success`, `on-pin` | Optional: text on buttons of those colors |

The first eleven are needed for each set of colors the file has. Any other property app.css has can be set too, and `moreContrast` can hold a theme's own colors for Increased contrast (`{ "light": {…}, "dark": {…} }`), as lines' own themes do; without it, lines works them out. Values are colors CSS reads; anything else (a `url()`, say) is left out, so a theme can't load anything from the web.

It's the same shape as a theme in a [plugin](plugins.md) (`Theme` in `src/lib/plugins/types.ts`), so a theme someone shares can become one of lines' own by adding an `id` to it in `src/plugins/themes/themes.ts`.

### Why not Base16?

The closest thing to a standard theme file across apps is [Base16](https://github.com/tinted-theming/home) (and Base24, its 24-color sibling): sixteen colors with set uses, from which templates make themes for hundreds of apps, and which Linux setups (Stylix, tinty, flavours) theme everything from. lines reads Base16 and Base24 schemes, and every other format below. But a Base16 scheme is one set of colors, light or dark, and names none of a notes app's parts: a lines theme has light and dark together, and a sidebar, a note list, faint text and callouts of its own. So lines writes its own files, which keep all of that, and reads the others.

## Importing themes from other apps

lines tells the format from the file, whatever it's named. A file with a light and a dark version of a theme (Zed's One, a foot config with both) becomes one theme with both; a family of several, such as Zed's Gruvbox, pairs each light one with the dark one of the same name.

| App | Files | Where to find them |
|---|---|---|
| [VS Code](https://code.visualstudio.com) | A color theme's `.json` (comments allowed) | In a theme's repository (often `themes/`), or run **Developer: Generate Color Theme From Current Settings** in VS Code for the theme you're using |
| [Zed](https://zed.dev) | A theme family's `.json` | `~/.config/zed/themes/`, or the theme's repository |
| TextMate, Sublime Text, bat | `.tmTheme` | The theme's repository |
| [Base16 and Base24](https://github.com/tinted-theming/schemes) | `.yaml` schemes, as now (`palette:`) or before (flat `base00:`) | tinted-theming/schemes has hundreds |
| [iTerm2](https://iterm2.com) | `.itermcolors` | Preferences → Profiles → Colors → Color Presets → Export, or [iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes), which has every terminal format below |
| [Alacritty](https://alacritty.org) | `.toml`, or the older `.yml` | Its `[colors]` |
| [Kitty](https://sw.kovidgoyal.net/kitty/) | `.conf` | `~/.config/kitty/`, or kitty-themes |
| [Ghostty](https://ghostty.org) | A theme file (no extension) | Ghostty's themes folder, `ghostty +list-themes` |
| [WezTerm](https://wezterm.org) | `.toml` color schemes | `~/.config/wezterm/colors/` |
| Windows Terminal | A scheme's `.json`, or `settings.json` with its `schemes` | Settings → Open JSON file |
| [foot](https://codeberg.org/dnkl/foot) | `foot.ini` | Its `[colors]`, or `[colors-dark]` and `[colors-light]` |
| Konsole | `.colorscheme` | `~/.local/share/konsole/` |
| X resources | `.Xresources` (urxvt, xterm, st), `#define`s too | `~/.Xresources` |
| [pywal](https://github.com/dylanaraps/pywal) | `colors.json` | `~/.cache/wal/` |
| KDE Plasma | `.colors` color schemes | `~/.local/share/color-schemes/` |
| GTK and libadwaita | `gtk.css` with `@define-color`, or libadwaita's `--window-bg-color` | `~/.config/gtk-4.0/gtk.css` |

What lines takes from each:

- **Editors** (VS Code, Zed, TextMate): the editor's background and text, the side bar or panel for lines' sidebar, menus, secondary and faint text, the accent (the first that's a color rather than a grey of buttons, focus, links and badges, in VS Code), error, warning and success colors, the terminal's colors, and code's colors from the scopes that keywords, strings, numbers, comments, functions and types are highlighted by.
- **Base16 and Base24**: each color as the [styling guide](https://github.com/tinted-theming/home/blob/main/styling.md) uses it: `base00` the background, `base01` the sidebar, `base03` faint text and comments, `base04` secondary text, `base05` text, `base08` to `base0E` red, orange, yellow, green, cyan, blue (the accent) and magenta, and code's colors as Base16's templates use them.
- **Terminals**: the background and text, and the sixteen ANSI colors: blue for the accent, red for danger, green for success, and the others for callouts and code; bright black for faint text and comments.
- **KDE**: the views' colors for the note, the windows' for the sidebar, the selection's for the accent, and the negative, neutral, positive, link and visited colors for the rest.
- **GTK**: the view's colors for the note, the window's or sidebar's for the sidebar, the accent, popovers, and the error, warning and success colors, with libadwaita's palette (`blue_3`, `red_3`…) where the file has it.

Whatever a theme doesn't have is worked out from what it does, as for your own: the note list between the note and the sidebar, secondary and faint text from the text, tags from the accent, made readable on their chips. Any of it can be changed after.

A plugin can teach lines more formats ([plugins.md](plugins.md#what-a-plugin-can-add)).
