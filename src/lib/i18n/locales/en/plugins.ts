/** Plugins (Settings → Plugins), and what lines' own plugins are called and do. */
export default {
  "plugins.intro":
    "Most of lines is plugins: the formats notes are written in, what draws math and diagrams, and its looks. Turn off what you don’t use. A note in a format that’s off shows as plain text, and nothing in it changes.",
  // Groups in the list.
  "plugins.groupFormats": "Formats",
  "plugins.groupEngines": "Engines",
  "plugins.groupLook": "Look",
  "plugins.groupMore": "More",
  "plugins.alwaysOn": "Always on",
  "plugins.needs": "Needs {names}, which is off.",
  // How a note shows while its format's plugin is off.
  "plugins.plainText": "Plain Text",
  // lines' own plugins. Markdown, LaTeX, Lucide and SF Symbols are names, not translated.
  "plugins.markdown.description": "Notes written in Markdown, formatted as you type, with lines’ additions: callouts, highlights, tags and mentions.",
  "plugins.latex.description": "Notes written in LaTeX, drawn as you type, and exported as documents that compile.",
  "plugins.spreadsheet": "Spreadsheets",
  "plugins.spreadsheet.description": "Notes that are spreadsheets: cells and formulas, kept as CSV. Opens CSV and Excel files, and downloads as either. In Markdown notes, ```csv blocks are spreadsheets too.",
  "plugins.http": "API Requests",
  "plugins.http.description": "Sends requests written in the .http format or Hurl’s, from .http and .hurl notes and ```http and ```hurl blocks in Markdown notes, shows their responses, and checks what Hurl entries assert. Adds /request and /hurl; a curl command pasted into a request becomes one.",
  "plugins.secrets": "Secrets",
  "plugins.secrets.description": "Shows {{name}} in Markdown notes as a secret kept in a locked note of type secrets, to show for a moment or copy, and adds /secret. Requests use secrets the same way.",
  "plugins.katex": "Math (KaTeX)",
  "plugins.katex.description": "Draws math in notes of any format, on screen and on paper.",
  "plugins.pele": "Diagrams (Pele)",
  "plugins.pele.description": "Draws mermaid code blocks as flowcharts, sequence diagrams and more, quickly and in the theme’s colors, and adds /diagram.",
  "plugins.mermaid": "Diagrams (Mermaid)",
  "plugins.mermaid.description": "Draws mermaid code blocks with Mermaid itself, instead of Pele: slower to load, with diagrams laid out as GitHub lays them out. Adds /diagram.",
  "plugins.models": "3D Models",
  "plugins.models.description": "Draws 3D models to turn around and zoom into: openscad blocks, made from their code by OpenSCAD as you type, stl blocks, and attached OpenSCAD, STL, OBJ, 3MF, glTF, STEP and IGES files. Adds /model.",
  "plugins.ironcalc": "Formulas (IronCalc)",
  "plugins.ironcalc.description": "Works out formulas like =SUM(B2:B4) in tables and spreadsheets, and reads and writes Excel workbooks.",
  "plugins.tex": "TeX Typesetting",
  "plugins.tex.description": "Typesets a LaTeX note’s PDF with TeX itself, instead of lines’ own pages.",
  "plugins.themes": "Themes",
  "plugins.themes.description": "Lines and fifteen more, including High Contrast and two for color blindness.",
  "plugins.lucide.description": "lines’ icons, from Lucide.",
  "plugins.sfSymbols.description": "Apple’s icons, drawn by your Mac, iPhone or iPad.",
  // Unsplash and GIPHY are names, not translated. {name} is one of them.
  "plugins.unsplash.description": "Adds /unsplash, to search Unsplash’s free photos and put one in a note. What you search for goes to Unsplash.",
  "plugins.unsplash.credit": "Photos from Unsplash",
  "plugins.giphy.description": "Adds /giphy, to search GIPHY’s GIFs and put one in a note. What you search for goes to GIPHY.",
  // asciinema is a name, not translated.
  "plugins.asciinema.description": "Plays terminal recordings in notes: asciinema.org’s embed code, and .cast files you add. Recordings on asciinema.org load from there.",
  "plugins.noKey": "Needs an API key from {name}, which this copy of lines wasn’t built with.",
};
