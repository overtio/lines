# Themes

lines comes with twenty-six themes, each light and dark, and presets that change the whole look beyond the colors: a 90s desktop, one-bit pixels, neon, a rainy day in a picture book, a spark of lightning, a pixel-art adventure game, glossy glass, brutalism, 1920s posters, heavy minimalism. You can also make your own themes and presets, share them as files, and import themes made for other apps: VS Code, Zed, Base16, your terminal or your Linux desktop.

Everything here is in Settings → Presets and Settings → Theme.

## Palettes and themes

A theme is a palette and what each of its colors is for. The palette is the theme's colors, as Nord is sixteen and Gruvbox a few more, each with a name, 32 at most; the theme says which of them each part of lines is drawn in, for light and dark: the note's background, the sidebar's, the text, the accent, tags, callouts, code and the rest. Where a theme's light and dark colors are each their own, it has a palette for each, as families of themes publish them: Catppuccin's Latte and Mocha, Dracula and Alucard, Ember Light and Ember Dark. Each of lines' themes has its own. Those made from a well-known palette (Nord, Solarized, Dracula, Catppuccin, Tokyo Night, Gruvbox, Everforest, Ayu, and Okabe–Ito's colors in Red-Green and Blue-Yellow) use its colors under their own names ("Polar Night 1", "base03", Catppuccin Mocha's "Mauve"), with any deepened or lightened ones lines' version needs; lines' own themes list their own colors, which lines names from how they look ("Teal", "Dark Gray", "Pale Pink"), in your language.

Shades aren't listed: what a theme leaves out is worked out from the rest. The note list is between the note and the sidebar, secondary and faint text are worked out from the text, tags from the accent (readable on their chips), text on buttons in the accent and status colors to read on them, and app.css mixes borders, hovers, the selection and code's background from the text and the accent. A part that has to read is drawn in its palette color made just light or dark enough where the color itself falls short, its hue kept: danger 4.5:1 on the note and in menus; success, the callouts and the colors tags and events can be given 3:1, as icons need. Increased contrast's colors are worked out too, for every theme ([below](#increased-contrast)).

## Your own themes

Below Light or dark, Contrast and Icons, Settings → Theme shows what the theme chosen is made of: the palette it's drawn in, for light and for dark, and which of the palette's colors each part of lines is, by name. One of lines' own is shown as it is; **Make a Copy** beside its name (or **New → From** it) makes a copy of it, with a copy of its palette, both yours, under **Your themes**, and opens it to change: its name, its palettes and its colors.

**New → From Wallhaven** (in the apps, with the Wallhaven [plugin](plugins.md)) does the same with a wallpaper found on [Wallhaven](https://wallhaven.cc): search, pick one, and its colors are a theme, named after what you searched for, which it can be the backdrop of too. Only wallpapers Wallhaven marks safe for work are searched.

**New → From a Picture** makes one from a picture's colors, a wallpaper or a photo, named after it, light and dark. The picture is read on this device, nothing is sent anywhere: its colors are grouped, its main tone tints the backgrounds (more of it the more colorful the picture, less in light, where a little goes a long way), its most vivid color that's also plentiful becomes the accent, and colors near red, green, blue and the rest color the callouts and code; the colors it finds are the theme's palette. The text reads at least 7:1 on the background, grey text 5:1 and the accent 4.5:1; a picture without color makes a theme in greys. **Use the Picture as the Backdrop** then puts it behind the page (Settings → Plugins → Paper → Backdrop). Like any of your themes, it can be changed color by color after.

- **Colors for** Light or Dark chooses which of its two sets of colors you're changing. The preview above the colors shows that set, as the sidebar, the note list and a note with a heading, a tag, a link, code and a callout; lines itself shows the set Light or dark asks for, as you change it.
- **Palette for light** and **Palette for dark** (**Palette**, for a theme with one set of colors) choose the palette each is drawn in: any of yours or lines' ([Palettes](#palettes)), the same for both or one each. Choosing another draws each part in its color nearest the one it had. A theme of yours drawn in one of lines' palettes can only use its colors; **Make a Copy** beside it draws it in a copy that's yours, to change and add to.
- Each part shows the palette color it's drawn in, by name, or Auto, and its swatch the color as lines draws it. Where lines draws the color a little darker or lighter for the part to read, the part says so. The swatch opens lines' color picker: the palette's colors first, each named (the arrow keys move through them), and, while the palette is yours, a color of your own, by saturation and brightness, hue, as text (any color CSS reads: `#7c3aed`, `rgb(124 58 237)`, `oklch(55% 0.2 290)`), or, in Chrome and Edge, picked from anywhere on the screen with the eyedropper. A change shows as you drag. It's drawn in the theme's colors and the style's look, as menus are.
- **Backgrounds, Text and Accent** are the colors every theme has. A background and text it must set; the others, left empty (Auto), are worked out from those ([above](#palettes-and-themes)). Borders, hovers, the selection, chips behind tags and code's background are mixed from them, the way lines' own themes work theirs out.
- **More Colors** has the ones a theme can leave to lines: danger, success, pinned and highlights, the five callouts, the seven colors for tags and events, formatting in notes, and code. Left empty (Auto), they're lines' own, and the swatch shows what that is; the arrow beside one empties it again.
- **Formatting** gives each kind of formatting in a note a color of its own, in Markdown and LaTeX notes alike: each heading level, bold, italics, strikethrough, underline, highlighted text (on the highlighter's color), inline code, links, mentions, quotes, bullets, and lists' numbers. On Auto, each is as lines draws it: in the color of the text it's in (bold in a link is the link's color, in a quote the quote's), but links, mentions, bullets and numbers in the accent, and quotes and the sixth heading in secondary text. A color you give one shows wherever it is, so formatting inside other formatting is in the innermost's: an italic word in bold text is in italics' color if it has one, bold's if not; each reads at least 4.5:1 on the note, made just dark or light enough if it falls short, as danger is. Markdown shown as written (Settings → Editor → Show Markdown → Source) colors what it draws: headings, bold, italics, strikethrough, links, mentions and quotes. Settings → Typography → **Heading color** is Theme to begin with, these; Accent or a color of your own colors every level over them, in any theme.
- A color of your own goes into the theme's palette: where the palette has the same color, the part is drawn in that one; otherwise the palette's color the part is drawn in changes, if nothing else in the theme is drawn in it, or a new color is added for it (or, with a palette that has 32 already, the part is drawn in its nearest). So two parts in one color stay together until you change one of them, and nothing else changes with it.
- **Delete** asks first, then shows Lines in its place.

### Changing colors by right-clicking

Settings → Theme → **Change colors by right-clicking** changes a theme bit by bit, where you see it. While it's on, right-clicking anything in lines (or pressing the menu key, or ⇧F10, on what has focus) opens the theme's colors it's drawn in, in place of its menu: its text, its border, and what's behind it down to the window (a row's hover, then the sidebar). Text in a note has the formatting it's in first, to change on its own: a bold word has Bold, then Text; a heading, its level (Heading 2); a link, Links, then Accent. Each has a swatch that opens the color picker, with the theme's colors to choose from, and its value as text, to type or paste any color CSS reads, and an arrow to put the theme's own back. A change shows at once, everywhere that color is used.

Changes wait to be saved: a bar at the bottom says how many there are, with **Save in Settings** and **Done** (which turns it off; the changes stay). In Settings → Theme, **Save as New Theme** makes a theme of your own from the theme with its changes (and a copy of its palette, with the colors changed in it), and shows it, its name ready to type over; in a theme of yours, **Save to** it puts them into it and its palette, as the editor does; **Discard Changes** asks, then puts the theme back as it was. Each theme keeps its own changes until then, on this device and in every window, through a restart.

What's changed is the theme's color for the scheme showing (a pane shown dark by Dark panes changes its dark colors). Some colors are mixed from others: borders, hovers and code's background are a little of Lines and shading, the selection and tag chips a little of the accent; changing one sets it alone, as a color of its own. A part drawn in a color the theme doesn't have (a picture, a callout's tint) says so.

Your themes and their palettes are kept on this device, like the rest of Settings, and change in every window at once (Settings, floating notes) as you edit them. They don't sync between devices yet; share one as a file to have it on another. A theme of yours from before palettes is drawn in a palette of its own colors, each once, named after it (one for light and one for dark, if they're more than a palette has): it looks as it did, and nothing of it is lost. A color you change goes into the palette of the scheme you're changing.

### Themes with only light or dark colors

Most themes made for other apps are one or the other: Dracula is dark, Solarized Light is light. Imported, such a theme says **Dark colors only**, and lines is dark with it whatever Light or dark says (Light or dark says so too).

**Make Light Colors** (or Make Dark Colors) works out the other set from the one it has: its backgrounds and text keep their tint at the lightness lines' own theme has there, and its accent, status, callout, code and formatting colors keep their hue, made light or dark enough to read on the new background. It's a start; change any of it after.

### Increased contrast

Settings → Theme → Contrast → Increased works with your themes as with lines' own: their grey text, faint text, accent and tags are darkened (lightened in dark) until they reach the same contrast ([accessibility.md](accessibility.md)), and a color a theme gives formatting in notes until it reads 7:1 on the note, as grey text does (formatting left on Auto follows the text, or the accent, darkened already). lines works these out from every theme's colors, its own too, each time they change, so there's nothing to set.

## Palettes

Settings → Theme → **Palettes**, below the theme's colors, lists lines' palettes and yours, under **Your palettes**, each a strip of its colors (pointing at one says its name), the one the theme showing is drawn in chosen. The arrow keys move through them. The one chosen shows its colors by name below; one of lines' has **Make a Copy**, to have one of yours like it.

A palette of yours shows its name and a row for each color: its swatch, which opens the color picker, the color as text, its name (left empty, lines names it from how it looks, which the field shows greyed), the arrows to move it up and down (by keyboard too: focus stays on the arrow, or goes to the other once it reaches the end), and × to take it out, which draws what was drawn in it in its nearest color left. **Add a Color** adds one to change, up to 32. A color changed changes what's drawn in it, in every theme of yours drawn in the palette; the note under its name says which they are. Where the color picker offers a palette of yours (a theme of yours drawn in it showing, in Settings → Typography's heading color, the cursor's or Paper's), **+** adds the color picked to it, named from its look.

- **New → From the Colors of** the theme showing makes one of its backgrounds, text and accent, to build from; **From a Picture** of a picture's main colors, read on this device; **Copy of** the palette chosen copies it. A new one is chosen, its name ready to type over.
- **Import → Choose a File** reads lines' palette files, and any other file with colors written in it, as CSS, a terminal's config or a list has them (`#7c3aed`, `rgb(124 58 237)`); **Import → Paste a Palette or Colors**, then ⌘V, reads text the same way. Each color is taken once, 32 at most, in the order they're written.
- **Share Palette**: **Copy Palette** copies its file's text, **Download Palette File** saves it (`Nord Copy.lines-palette.json`), and **Share**, where there's a share sheet, sends it.
- **Delete Palette** asks first, in the page. While themes of yours are drawn in it, it asks which palette to draw them in instead, each part in its nearest color, and does that as it deletes it, so no theme is left without its colors.

Palettes of yours are kept on this device with your themes, and change in every window at once.

## Presets

A theme is colors. A preset is the whole look in one: the theme, and the style that goes with it (how round the corners are, the type, the lines and shadows, and what makes it itself), with the rest of how lines looks. Choosing one sets every setting it has; **Undo**, just after (after trying several, too), puts back the look you had before them. Settings → Presets has eleven:

- **Lines**: soft corners, quiet shadows and your system's font, as lines has always looked, and every other look setting as lines first has it.
- **Classic**: a desktop of the late 90s. Raised and sunken bevels lit from the top left, a title bar with a gradient over the note list, the selection in the accent, square corners, Tahoma, scroll bars with arrow buttons, and the 90s pointer.
- **Pixel**: one-bit and minimal. A pixel font (Pixelify Sans, with VT323 for code), 2px lines, hard shadows a pressed button drops, what's chosen turned around, square everything, things changing at once rather than easing, a block cursor and the 90s pointer.
- **Neon**: a city at night. Lines and text that glow in the accent and the tags' color, a faint grid behind the note and scan lines over everything, headings in a wide display face (Orbitron), buttons with their corners cut, a thick glowing cursor and a comet behind the pointer.

- **Puddle**: a rainy day in a picture book, in its colors: the rain blue most of it is drawn on for the sidebar, a sweater's seafoam for the note list and cream paper for the note (night rain in dark), a navy accent, tags in a coral wall's rose (on a pale coral chip), a beak's mustard for highlights, and tag colors from the same picture, deepened to read; crisp ink lines around what can be pressed or typed in, around what floats and around what's chosen; flat fills with no shadows, rounder corners, and the system's rounded font.
- **Lightbulb**: a spark of lightning drawn as a cartoon, in five colors: lemon for the sidebar (and a paler lemon for the note list, near-white for the note), a red accent, tags in a deep cedar on a gold chip, lemon highlights, and black ink (lemon in dark, where the accent is lemon too and tags are a lighter red); bold ink lines around what can be pressed or typed in, around what floats and around what's chosen, hard shadows of the same ink under cards, menus and dialogs, round corners, and a thick cursor that throws sparks.
- **Adventure**: the pixel art of a 2D adventure game. Buttons, fields and groups of settings are framed slots with notched corners, lit from the top left and pressed in when held; the chosen note and sidebar row are slots picked out in the accent; grass grows along the bottom of the title bars; headings in notes drop a hard shadow; a chunky pixel font (Pixelify Sans, with VT323 for code), and things move in steps rather than gliding.
- **Aero**: glossy glass of the 2000s. Gel buttons with a shine across their top half, fields and switches as glossy pills with orbs for knobs, frosted see-through menus and dialogs, a sheen down the panes, and behind the note a sky's glow and a few soft bubbles in a corner (not with a paper). With Increased contrast the glass is solid and the sheen and sky gone.
- **Brutalist**: the structure on show. Every border a solid line in the text's color, thick rules under the title bars and around fields, groups, menus and dialogs, titles and buttons in uppercase monospace, buttons that turn inside out under the pointer, the chosen row a solid block of the accent, a big tight first heading, and no shadows, rounding or easing. Its font is your system's Helvetica (Arial where there's none).
- **Constructivist**: the graphic language of 1920s avant-garde posters. Red, black and paper; titles, buttons and headings in heavy condensed capitals (Oswald); under each title bar a black rule with a red band on it, cut on a slant; the chosen row a red wedge, and the main button too; groups of settings with a red band along their top, menus and dialogs dropping a red block of shadow; red bars under the first two levels of headings; and behind the note a large faint circle crossed by a diagonal band (not with a paper). The text stays level: the diagonals are only decoration.
- **Void**: heavy minimalism, everything that isn't the words taken away. No lines, boxes, shadows or backgrounds behind rows; the panes apart only by space; one size of type for the whole app, and headings in notes the text's size, set apart by weight; buttons and choices as words; what's chosen in full black with a small dot in the accent, the rest grey; fields and switches as hairlines. Choosing it also turns on two settings from Settings → Layout that work in any style, Hide toolbars and Icons off ([Fewer things in sight](#fewer-things-in-sight)), which another preset turns off again.

Each but Lines comes with a color theme made for it (Classic, Pixel, Neon, Puddle, Lightbulb, Adventure, Aero, Brutalist, Constructivist and Void, in the Themes list too). Anything can be changed after: another theme, and the style keeps its shapes in those colors (its bevels, lines and glows are made from the theme's own colors), or any other setting. A style that has its own font is notes' first font in Settings → Typography too, in place of the system's; the other fonts there still work with it.

### What a preset has

- **Theme:** the theme (a theme of your own goes along in a preset's file), the style, Dark panes, Monochrome, Invert, the icons and headings' color.
- **Layout:** Hide toolbars, and whether icons show.
- **Typography:** the font (a font installed on the device too, by its name), formatting's fonts, the spacing and the note's width.
- **Paper:** the pattern, texture and their color, size and strength; the backdrop and the page over it.
- **Cursor:** the text cursor's shape, width, color, blink, moving and effect; the pointer and what follows it.
- **Mascot:** which, and how big.
- **Window** (Mac app): how see-through it is, the blur behind it, and what of it is see-through.

What's yours to see by stays as you set it, whichever preset you choose: Light or dark, Contrast and the text's size.

### Your presets

**Save as Preset** keeps the look you have now as a preset of your own, under **Your presets**, named for the one it came from, its name ready to type over. Change anything after choosing a preset and it says so, with **Back to** it, and, for one of yours, **Update Preset** to keep the change in it. Below a preset of yours are its name, to change, the share button and **Delete**.

Your presets are kept on this device, like the rest of Settings, and in every window at once. They don't sync between devices yet; share one as a file to have it on another.

### Sharing a preset

The share button beside your preset's name has **Share** (your system's share sheet, where there is one), **Copy Preset** (its file's text, to paste into a message) and **Download Preset File** (`Late Night.lines-preset.json`). Whoever gets it adds it with **Import → Choose a File**, or **Import → Paste a Preset**, in Presets; it's added to their presets and chosen, and Undo puts back what they had.

A preset's file is JSON: its `name`, `author` if you like, its `settings` by the names lines keeps them by, and, when its theme is one of your own, that theme as a theme file has it, palette and all (`theme`), which is added to theirs (or the same one used, if they have it). A picture of your own behind the page isn't in the file: the backdrop comes as none. Settings missing from a file are lines' own, and one lines can't read is left out the same way, so a file from an older or newer lines still works. Themes, patterns, mascots and the like that come from a plugin are kept by their id: while that plugin is off, lines shows its own in their place.

Styles are plugins (the Styles plugin has the ten beside Lines), and a plugin can add more presets, with the settings each brings: what one can set, and how it reaches each part of the app, is in [plugins.md](plugins.md#what-a-plugin-can-add). Neon's glow and scan lines go with Increased contrast, and its grid while a paper is chosen. Presets change how lines looks, not what it prints: a note's PDF is black on white with every one.

## Fewer things in sight

Two settings in Settings → Layout take away what isn't the note, in any theme and style:

- **Hide toolbars**: the bars over the note and the note list, and the sidebar's top and bottom (its button, the version and the footer), stay out of sight until the pointer comes near them, and show as soon as Tab moves into them. On a touch screen, with nothing to point with, they always show.
- **Icons** off: a button that's only an icon shows its name in words instead (the toolbar's Lock note, Note info, Share…; Settings' Close), and other icons go: the sidebar's, Settings', those beside a button's words, the search field's magnifier. Those that say something stay: checkmarks, and the chevrons that show whether something is open (nested tags, Settings' groups). A note row's pinned and locked marks show as words (Pinned · Locked note · 8:37 PM), and a note's own icon goes. What's in a note keeps its icons, a block's buttons too.

Settings → Editor → **Drag to move lines** off takes away the grip that shows beside the line or block you point at; lines and blocks still move with ⌥↑ and ⌥↓.

## Dark panes

Settings → Theme → **Dark panes** shows the sidebar, the note list or both in the theme's dark colors while lines is light, so the note is a light page beside dark panes. It works with every theme: the panes take the theme's own dark colors (for a theme with light colors only, ones worked out from them as Make Dark Colors does), Increased contrast's too, and Monochrome and Invert change them as they do the rest of the window. A style keeps its shapes in them: Classic's bevels, Pixel's lines, Neon's glow, Adventure's slots and grass, Aero's gloss, Brutalist's rules and Constructivist's bands are made from the panes' colors there. While lines is dark, the panes are dark anyway, and there's nothing for it to change. The theme picker's swatches show the sidebar dark while it's on.

## Monochrome and Invert

Two switches in Settings → Theme change whatever theme is chosen, yours or lines' own:

- **Monochrome** shows every color of the theme as a grey: the accent, tags, links, callouts, code, everything. Each grey is exactly as light as its color was (to WCAG's measure), so every bit of text has the contrast it had.
- **Invert** turns the theme around, light for dark: a light theme becomes a dark one (white becomes black), a dark one light. Each color keeps its hue, and its lightness is mirrored so that any two colors are as far apart as before (each color's luminance plus 0.05 becomes 0.0525 divided by it): what read at 7:1 still reads at 7:1. Light or dark chooses which of the theme's colors are turned. Highlights stay bright, as they are in lines' dark themes.

Both together give the theme in greys, turned. They apply on top of Increased contrast, in every window, and to diagrams, 3D models and recordings, which take the theme's colors. Pictures, and drawings' own pen colors, stay as they are. The theme picker's swatches and your theme's editor show the theme's own colors.

## Sharing a theme

The share button beside your theme's name shares it with its palettes, in one file:

- **Share** sends the theme's file through your system's share sheet (AirDrop, Messages, Mail…), where there is one.
- **Copy Theme** copies the file's text, to paste into a message.
- **Download Theme File** saves it: `Dracula.lines-theme.json`.

Whoever gets it adds it with **Import → Choose a File**, or **Import → Paste a Theme** for text they copied. Themes of other apps are imported the same way, and several files can be chosen at once.

## lines' theme files

A lines theme file is JSON: the theme's name, who made it if you like, its palette, and which of the palette's colors each part is drawn in, for light, dark or both, by the names of app.css's custom properties without their `--`:

```json
{
  "name": "Dracula",
  "author": "Zeno Rocha",
  "palette": {
    "name": "Dracula",
    "author": "Zeno Rocha",
    "colors": [
      { "id": "background", "name": "Background", "color": "#282a36" },
      { "id": "current-line", "name": "Current Line", "color": "#44475a" },
      { "id": "foreground", "name": "Foreground", "color": "#f8f8f2" },
      { "id": "comment", "name": "Comment", "color": "#6272a4" },
      { "id": "purple", "name": "Purple", "color": "#bd93f9" },
      { "id": "pink", "name": "Pink", "color": "#ff79c6" },
      { "id": "yellow", "name": "Yellow", "color": "#f1fa8c" }
    ]
  },
  "dark": {
    "bg": "background",
    "bg-elevated": "current-line",
    "text": "foreground",
    "text-faint": "comment",
    "accent": "purple",
    "syn-keyword": "pink",
    "syn-string": "yellow"
  }
}
```

A palette's colors each have an `id`, which the theme's parts refer to (lowercase letters, digits, `-` and `_`), a `name` if it has one of its own (otherwise lines names it from how it looks), and the `color`, hex or `rgb()`; any other color CSS reads is turned into one. A file can name one of lines' own palettes by its id instead (`"palette": "nord"`). A theme with a palette for each scheme has them as `"palette": { "light": …, "dark": … }`, each there or by id, and each scheme's parts refer to its own palette's colors. A palette shared alone (`.lines-palette.json`) is the palette as it is here: its `name`, `author` if it has one, and its `colors`.

| Parts | What they are |
|---|---|
| `bg`, `bg-list`, `bg-sidebar`, `bg-elevated` | The note's background, the note list's, the sidebar's, and menus' and dialogs' |
| `text`, `text-sidebar`, `text-muted`, `text-faint` | Text, the sidebar's, secondary (previews, notes in Settings) and faint (dates, counts, hints) |
| `accent`, `tag-text` | Links, buttons and what's chosen; tags |
| `ink` | What borders, hovers and code's background are mixed from: usually the text color |
| `danger`, `success`, `pin`, `highlight-base` | Deleting and errors, success, pinned notes, highlights |
| `callout-info`, `callout-question`, `callout-warning`, `callout-error`, `callout-decision` | The callouts |
| `palette-red`, `palette-orange`, `palette-yellow`, `palette-green`, `palette-blue`, `palette-purple`, `palette-gray` | The colors tags, types and events can be given (Icon and Color, or `color:` in a note), and marks in the margin; with the accent, eight. Each at least 3:1 against every background, as icons need |
| `syn-keyword`, `syn-string`, `syn-number`, `syn-comment`, `syn-function`, `syn-type` | Code |
| `text-h1` to `text-h6`, `text-bold`, `text-italic`, `text-strike`, `text-underline`, `text-highlight`, `text-code`, `text-link`, `text-mention`, `text-quote`, `text-bullet`, `text-number` | Formatting in notes: each heading level, bold, italics, strikethrough, underline, highlighted text, inline code, links, mentions, quotes, bullets and lists' numbers. Left out, each is in the color of the text around it, but links, mentions, bullets and numbers in the accent, and quotes and `text-h6` in `text-muted` |
| `on-accent`, `on-danger`, `on-success`, `on-pin` | Text on buttons of those colors |

Each is optional but the background and text: what a theme leaves out is worked out from the rest, or is lines' own ([Palettes and themes](#palettes-and-themes)), and any other property app.css has can be given a color too. `properties` (`{ "light": {…}, "dark": {…} }`) can set the rest of how a theme draws, made only from its own colors: how much of one a mix takes (`"border": "color-mix(in srgb, var(--ink) 62%, transparent)"`, as High Contrast's strong borders), a part drawn as another is (`"callout-info": "var(--accent)"`), callouts' tint, a shadow. Anything else (a color of its own, a `url()`) is left out, so a theme can't load anything from the web.

Theme files from before palettes, with colors by part (and `moreContrast`, which lines works out now), still read: their colors become the theme's palette, or one for each scheme if they're more than 32.

It's the same shape as a theme in a [plugin](plugins.md) (`ThemeDefinition` and `Palette` in `src/lib/plugins/types.ts`), so a theme someone shares can become one of lines' own by giving it an `id` in `src/plugins/themes/themes.ts`, its palette beside it.

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
- **Terminals**: the background and text, and the sixteen ANSI colors: blue for the accent, red for danger, green for success, the others for callouts and code, and red, yellow, green, blue and magenta (as purple) for tags' and events' colors, each made readable on the backgrounds; bright black for faint text and comments.
- **KDE**: the views' colors for the note, the windows' for the sidebar, the selection's for the accent, and the negative, neutral, positive, link and visited colors for the rest.
- **GTK**: the view's colors for the note, the window's or sidebar's for the sidebar, the accent, popovers, and the error, warning and success colors, with libadwaita's palette (`blue_3`, `red_3`…) where the file has it.

The colors a theme has are its palette, each once, and whatever it doesn't have is worked out from them, as for your own: the note list between the note and the sidebar, secondary and faint text from the text, tags from the accent, made readable on their chips. Any of it can be changed after.

A plugin can teach lines more formats ([plugins.md](plugins.md#what-a-plugin-can-add)).

## Themes for other apps

lines' theme tools go the other way: they make themes for VS Code, GTK and Base24 from a lines theme, and swatches and themes from pictures and videos ([theme-tools.md](theme-tools.md)).
