/** The editor: slash and backslash menus, the format toolbar, tables, attachments, callouts, mentions, properties, type tables. */
export default {
  // The note's text box, as screen readers name it.
  "editor.note": "Note",
  "editor.placeholder": "Start writing…",

  // The "/" menu's sections.
  "editor.section.format": "Format",
  "editor.section.insert": "Insert",

  // The "/" menu's commands. Each has words that find it besides its name, separated by spaces;
  // English's words find it in every language too.
  "editor.slash.text": "Text",
  "editor.slash.text.keywords": "paragraph plain normal body",
  "editor.slash.heading1": "Heading 1",
  "editor.slash.heading1.keywords": "h1 title big",
  "editor.slash.heading2": "Heading 2",
  "editor.slash.heading2.keywords": "h2 subtitle",
  "editor.slash.heading3": "Heading 3",
  "editor.slash.heading3.keywords": "h3 small",
  "editor.slash.todo": "Todo",
  "editor.slash.todo.keywords": "task checkbox check checklist",
  "editor.slash.bulletList": "Bullet list",
  "editor.slash.bulletList.keywords": "unordered ul point dash",
  "editor.slash.numberedList": "Numbered list",
  "editor.slash.numberedList.keywords": "ordered ol number",
  "editor.slash.quote": "Quote",
  "editor.slash.quote.keywords": "blockquote citation",
  "editor.slash.codeBlock": "Code block",
  "editor.slash.codeBlock.keywords": "snippet pre fence",
  // A Mermaid diagram.
  "editor.slash.diagram": "Diagram",
  "editor.slash.diagram.keywords": "mermaid flowchart chart graph sequence",
  "editor.slash.model": "3D model",
  "editor.slash.model.keywords": "openscad scad cad 3d model stl mesh print solid",
  // A WaveDrom diagram: signals over time, as in digital electronics.
  "editor.slash.timing": "Timing diagram",
  "editor.slash.timing.keywords": "wavedrom waveform signal clock bus register bitfield logic gate digital electronics",
  "editor.slash.request": "API request",
  "editor.slash.request.keywords": "http rest api request curl get post fetch endpoint",
  "editor.slash.hurl": "Hurl test",
  "editor.slash.hurl.keywords": "hurl test assert api request check http",
  "editor.slash.secret": "Secret",
  "editor.slash.secret.keywords": "password token key api credential",
  // A block of LaTeX math.
  "editor.slash.math": "Math",
  "editor.slash.math.keywords": "latex tex katex equation formula",
  // A box around text (`:::`).
  "editor.slash.card": "Card",
  "editor.slash.card.keywords": "box panel section block callout container",
  "editor.slash.table": "Table",
  "editor.slash.table.keywords": "grid columns rows",
  // A ```csv block, drawn as a spreadsheet's grid.
  "editor.slash.spreadsheet": "Spreadsheet",
  "editor.slash.spreadsheet.keywords": "csv cells formulas sheet excel calculate",
  "editor.slash.image": "Image",
  "editor.slash.image.keywords": "picture photo screenshot upload",
  "editor.slash.unsplash": "Photo",
  "editor.slash.unsplash.keywords": "unsplash picture image stock search web",
  "editor.slash.giphy": "GIF",
  "editor.slash.giphy.keywords": "giphy animated meme reaction funny",
  "editor.slash.file": "File",
  "editor.slash.file.keywords": "attach attachment upload document pdf",
  "editor.slash.drawing": "Drawing",
  "editor.slash.drawing.keywords": "excalidraw sketch draw whiteboard",
  // A horizontal line (`---`).
  "editor.slash.divider": "Divider",
  "editor.slash.divider.keywords": "rule line separator hr break",
  // Where a printed note goes on to a new page.
  "editor.slash.pageBreak": "Page break",
  "editor.slash.pageBreak.keywords": "new page pagebreak print pdf split separator",
  "editor.slash.link": "Link",
  "editor.slash.link.keywords": "url web href",
  // Put in place of the link's text, selected, ready to type over.
  "editor.slash.link.text": "link text",
  // A link to a research paper, found by searching a source of them (arXiv).
  "editor.slash.paper": "Paper",
  "editor.slash.paper.keywords": "research article study science preprint citation reference academic arxiv",
  // A #tag.
  "editor.slash.tag": "Tag",
  "editor.slash.tag.keywords": "hashtag label",
  // An @mention of another note.
  "editor.slash.mention": "Mention",
  "editor.slash.mention.keywords": "link note person object reference",
  // A table of the notes of a type (`@type.recipe`).
  "editor.slash.typeTable": "Type table",
  "editor.slash.typeTable.keywords": "objects database query list type notes of",
  // The note's properties (front matter).
  "editor.slash.properties": "Properties",
  "editor.slash.properties.keywords": "type object metadata front matter fields attributes",
  // Today's date.
  "editor.slash.date": "Date",
  "editor.slash.date.keywords": "today time now",
  // Shown faintly beside it in the menu.
  "editor.slash.date.hint": "today",

  // Callouts: cards named for what they hold. Each is also a "/" command, found by these words too.
  "editor.callout.info": "Info",
  "editor.callout.info.keywords": "callout note tip hint about fyi",
  "editor.callout.question": "Question",
  "editor.callout.question.keywords": "callout ask open unknown unsure help",
  "editor.callout.warning": "Warning",
  "editor.callout.warning.keywords": "callout caution careful attention alert important",
  "editor.callout.error": "Error",
  "editor.callout.error.keywords": "callout danger problem bug failure broken",
  "editor.callout.decision": "Decision",
  "editor.callout.decision.keywords": "callout decided choice agreed resolved outcome",
  // The icon picker's title for a callout's icon: "Warning callout".
  "editor.callout.named": "{kind} callout",
  "editor.callout.changeIcon": "Change icon…",
  "editor.callout.addIcon": "Add icon…",

  // The outline beside a note (Settings → Layout): its headings, by name when pointed at.
  "editor.outline": "Outline",
  "editor.outline.headings": "Headings",

  // The toolbar over selected text.
  "editor.format": "Format",
  "editor.format.bold": "Bold",
  "editor.format.italic": "Italic",
  "editor.format.underline": "Underline",
  "editor.format.strike": "Strikethrough",
  "editor.format.code": "Code",
  "editor.format.highlight": "Highlight",
  // A toolbar button's tooltip: "Bold (⌘B)".
  "editor.format.withShortcut": "{format} ({shortcut})",

  // A todo's checkbox, named for screen readers when the todo has no text.
  "editor.checkbox": "Todo",
  "editor.image": "Image",
  "editor.imageFailed": "This image couldn’t be shown",
  "editor.imageNotHere": "This image isn’t on this device yet",
  "editor.image.resizeHint": "Drag to resize, double-click for its own size",
  // An attached file: how to open it, and what's shown while it hasn't been synced to this device.
  "editor.file.open": "Double-click to open",
  // Excalidraw drawings (SVG images that hold their scene), opened full-window to change.
  "editor.drawing": "Drawing",
  "editor.drawing.edit": "Edit Drawing",
  "editor.drawing.editHint": "Edit drawing (double-click, or Enter when selected)",
  "editor.drawing.title": "Drawing",
  "editor.drawing.save": "Save",
  "editor.drawing.cancel": "Cancel",
  "editor.drawing.loading": "Loading Excalidraw…",
  "editor.drawing.loadFailed": "Excalidraw couldn’t be loaded.",
  "editor.drawing.mermaidFailed": "This diagram couldn’t be turned into a drawing: {error}",
  // The button on a Mermaid diagram that opens a copy of it in Excalidraw, put below the code on Done.
  "editor.drawing.fromDiagram": "Copy and Edit as Drawing",
  "editor.drawing.saveFailed": "The drawing couldn’t be saved.",
  "editor.drawing.discardQuestion": "Discard your changes to this drawing?",
  "editor.drawing.discard": "Discard Changes",
  "editor.drawing.keepEditing": "Keep Editing",
  "editor.drawing.hint": "Save ({keys}) puts it in the note. Undo in the note brings back the drawing before.",
  "editor.file.notHere": "Not on this device yet",
  // A file's kind and size: "PDF · 2.4 MB".
  "editor.file.meta": "{kind} · {size}",
  // The name an attached file gets when it has none.
  "editor.file.name": "File",
  // Audio and video in a note: its play button, and the slider for how far it's played ("1:02 of 3:15" read aloud, "1:02 / 3:15" shown).
  "editor.media.play": "Play",
  "editor.media.pause": "Pause",
  "editor.media.position": "Position",
  "editor.media.time": "{time} of {duration}",
  "editor.media.elapsed": "{time} / {duration}",
  // A terminal recording (asciinema) played in a note, named for screen readers, and what shows when it can't load.
  "editor.recording": "Terminal recording",
  "editor.recording.failed": "This recording couldn’t be loaded",
  "editor.size.bytes": "{count, plural, one {# byte} other {# bytes}}",
  "editor.size.kb": "{size} KB",
  "editor.size.mb": "{size} MB",
  "editor.size.gb": "{size} GB",

  // Copy buttons: on code blocks, table cells and "Key: Value" lines.
  "editor.copy": "Copy",
  "editor.copyValue": "Copy {value}",
  "editor.copyCode": "Copy code",
  "editor.copyCell": "Copy cell",
  "editor.copied": "Copied",
  // The button on a code block that tidies its code.
  "editor.formatCode": "Format code",
  "editor.codeFormatted": "Code formatted",
  "editor.formatFailed": "Couldn’t format: {error}",

  // A Mermaid diagram, as screen readers name it.
  "editor.diagram": "Diagram",
  "editor.emptyDiagram": "Empty diagram",
  // WaveJSON with nothing WaveDrom draws. signal, reg and assign are written as they are.
  "editor.wavedrom.what": "A WaveDrom diagram needs signals (signal: […]), a register’s fields (reg: […]) or logic (assign: […]).",

  // The grip left of a line, for dragging it elsewhere.
  "editor.dragHandle": "Drag to move, click to select",

  // Mentions (`@Oleks`, `@Oleks.city`) and type chips (`@type.recipe`).
  "editor.untitled": "Untitled",
  // A type chip's tooltip: "Recipe: 3 notes".
  "editor.mention.type": "{type}: {count, plural, one {# note} other {# notes}}",
  "editor.mention.noneOfType": "No notes of the type {type} yet",
  // A mentioned note's tooltip: its title and type, "Pasta · Recipe".
  "editor.mention.note": "{title} · {type}",
  // A mentioned property's tooltip: the note's title and the property, "Oleks · city".
  "editor.mention.property": "{title} · {key}",
  // A mentioned property, as screen readers say it: its value, then whose it is.
  "editor.mention.value": "{value} ({title} · {key})",
  "editor.mention.locked": "“{title}” is locked",
  "editor.mention.noValueYet": "“{title}” has no {key} yet",
  "editor.mention.noKey": "“{title}” has no {key}",
  // The card over a mention of a note there isn't.
  "editor.mention.missing": "No note called “{title}”",
  "editor.mention.create": "Create",
  "editor.mention.created": "Created “{title}”",

  // Type tables: a table of the notes of a type.
  "editor.typeTable.label": "Notes of the type {type}",
  "editor.typeTable.empty": "No notes of the type {type} yet.",
  "editor.typeTable.remove": "Remove {column}",
  "editor.typeTable.addColumn": "Add a column…",
  // The button under the table that makes a new note of its type: "New Recipe".
  "editor.typeTable.new": "New {type}",
  "editor.typeTable.open": "Open {title}",

  // The find bar over a note (⌘F). {current} and {count}: "3 of 12".
  "editor.find.label": "Find in note",
  "editor.find.find": "Find",
  "editor.find.replaceWith": "Replace with",
  "editor.find.count": "{current} of {count}",
  "editor.find.matches": "{count, plural, =0 {No results} one {# result} other {# results}}",
  "editor.find.many": "{count}+ results",
  "editor.find.invalid": "Not a valid pattern",
  "editor.find.matchCase": "Match case",
  "editor.find.regexp": "Regular expression",
  "editor.find.wholeWord": "Whole words only",
  "editor.find.previous": "Previous match",
  "editor.find.next": "Next match",
  "editor.find.close": "Close",
  "editor.find.showReplace": "Replace",
  "editor.find.replace": "Replace",
  "editor.find.replaceAll": "Replace All",
  // The picker /unsplash, /giphy and /paper open, where {name} is what's searched: Unsplash, GIPHY, arXiv.
  "editor.web.search": "Search {name}",
  "editor.web.searching": "Searching…",
  "editor.web.found": "{count, plural, one {# result} other {# results}}",
  "editor.web.none": "Nothing found for “{query}”.",
  "editor.web.failed": "Couldn’t reach {name}.",
  "editor.web.retry": "Try Again",
  // A picture in the picker, and who made it.
  "editor.images.by": "{image}, by {name}",
  // Papers in the picker: what it says before anything's typed, and a paper's authors when there are more than two.
  "editor.papers.hint": "Search by title, author or topic, or paste a link to a paper.",
  "editor.papers.etAl": "{name} et al.",

  // CodeMirror's own words: what it says to screen readers, and its go-to-line box. `$` is a number
  // CodeMirror fills in; keep it.
  "editor.cm.close": "close",
  "editor.cm.currentMatch": "current match",
  // "current match. … on line 12."
  "editor.cm.onLine": "on line",
  "editor.cm.replacedMatches": "replaced $ matches",
  "editor.cm.replacedMatchOnLine": "replaced match on line $",
  "editor.cm.goToLine": "Go to line",
  "editor.cm.go": "go",
  // The "/" and "@" menus, as screen readers name them.
  "editor.cm.completions": "Suggestions",
  "editor.cm.controlCharacter": "Control character",
  "editor.cm.selectionDeleted": "Selection deleted",
  // Said by screen readers only: a bullet, and markup hidden from sight (a card's ::: lines, the properties' ---, a code block's fences).
  "editor.a11y.bullet": "Bullet",
  // A page break in a note, as it shows and as screen readers say it.
  "editor.pageBreak": "Page break",
  "editor.a11y.cardStart": "Card",
  "editor.a11y.cardEnd": "End of card",
  "editor.a11y.calloutStart": "{kind} callout",
  "editor.a11y.calloutEnd": "End of {kind} callout",
  "editor.a11y.propertiesStart": "Properties",
  "editor.a11y.propertiesEnd": "End of properties",
  "editor.a11y.codeStart": "Code",
  "editor.a11y.codeEnd": "End of code",
  // A rendered table's button: turns it into a ```csv block, drawn as a spreadsheet.
  "editor.toSpreadsheet": "Convert to Spreadsheet",
};
