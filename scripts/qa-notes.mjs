// Writes the QA notes in qa/notes/: every Linedown element on its own, inside every container, and
// right after every other element, plus inline styles, callouts and edge cases. A QA engineer adds
// them to lines (Settings → Data → Add QA Notes) and looks through each before a release; see
// qa/README.md.
//
// When a feature adds something that can appear in a note, add it to ELEMENTS (and to CONTAINERS
// if other things can go inside it), then run `bun run qa-notes` and commit the notes it writes.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "qa", "notes");

/*
 * Elements: one example of each thing a note can hold. `attachment:<file>` links are replaced with
 * real attachments (from src/lib/notes/samples/) when the notes are added to lines.
 */
const ELEMENTS = [
  {
    id: "paragraph",
    name: "Paragraph",
    md: "A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.",
  },
  {
    id: "long-paragraph",
    name: "Long paragraph",
    md: "A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.",
  },
  { id: "h1", name: "Heading 1", md: "# Heading one" },
  { id: "h2", name: "Heading 2", md: "## Heading two" },
  { id: "h3", name: "Heading 3", md: "### Heading three" },
  {
    id: "bullets",
    name: "Bullet list",
    md: "- First item\n- Second item\n  - Nested item\n    - Third level\n- Last item",
  },
  { id: "numbers", name: "Numbered list", md: "1. First\n2. Second\n   1. Nested\n3. Third" },
  { id: "todos", name: "Todo list", md: "- [x] Done todo\n- [ ] Open todo\n  - [ ] Nested open todo" },
  { id: "quote", name: "Quote", md: "> A quote that runs over\n> two lines." },
  { id: "code", name: "Code block", md: "```\nplain code\n  indented line\n```" },
  { id: "code-ts", name: "Code block (TypeScript)", md: '```ts\nconst greeting: string = "hello";\nconsole.log(greeting);\n```' },
  { id: "json", name: "JSON block (no language)", md: '```\n{"name":"lines","tags":["a","b"],"id":12345678901234567890}\n```' },
  { id: "diagram", name: "Diagram", md: "```mermaid\nflowchart LR\n  A[Start] --> B{Choice}\n  B --> C[Done]\n```" },
  { id: "diagram-sized", name: "Diagram (240 px wide)", md: "```mermaid |240\nflowchart LR\n  A[Small] --> B[Diagram]\n```" },
  {
    id: "model",
    name: "3D model (openscad block), a colored part, an echo",
    md: "```openscad\ndifference() {\n  cube(20, center = true);\n  sphere(r = 13);\n}\ntranslate([25, 0, 0]) color(\"tomato\") cylinder(h = 10, r = 5);\necho(\"made\");\n```",
  },
  { id: "model-flat", name: "Flat model (openscad block)", md: "```openscad\nsquare(20);\ntranslate([30, 10]) circle(8);\n```" },
  { id: "model-broken", name: "Broken model (openscad block)", md: "```openscad\ncube(10)\nsphere(3;\n```" },
  {
    id: "model-stl",
    name: "3D model (stl block)",
    md: "```stl\nsolid pyramid\nfacet normal 0 0 -1\nouter loop\nvertex 0 0 0\nvertex 10 10 0\nvertex 10 0 0\nendloop\nendfacet\nfacet normal 0 0 -1\nouter loop\nvertex 0 0 0\nvertex 0 10 0\nvertex 10 10 0\nendloop\nendfacet\nfacet normal 0 -1 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 5 5 8\nendloop\nendfacet\nfacet normal 1 0 1\nouter loop\nvertex 10 0 0\nvertex 10 10 0\nvertex 5 5 8\nendloop\nendfacet\nfacet normal 0 1 1\nouter loop\nvertex 10 10 0\nvertex 0 10 0\nvertex 5 5 8\nendloop\nendfacet\nfacet normal -1 0 1\nouter loop\nvertex 0 10 0\nvertex 0 0 0\nvertex 5 5 8\nendloop\nendfacet\nendsolid pyramid\n```",
  },
  { id: "math", name: "Math block", md: "$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$" },
  {
    id: "table",
    name: "Table",
    md: "| Left | Center | Right |\n| :--- | :----: | ----: |\n| a | **b** | 1 |\n| longer cell text | `code` | 22 |",
  },
  {
    id: "table-formulas",
    name: "Table with formulas",
    md: "| Item | Cost |\n| --- | ---: |\n| Rent | 1200 |\n| Food | 450.50 |\n| Total | =SUM(B2:B3) |\n| Broken | =B2/0 |",
  },
  {
    id: "hurl",
    name: "Hurl entries (hurl block): a capture used by the next entry, and asserts",
    md: "```hurl\n# A todo\nGET https://jsonplaceholder.typicode.com/todos/1\nHTTP 200\n[Captures]\nowner: jsonpath \"$.userId\"\n[Asserts]\njsonpath \"$.id\" == 1\n\n# Its owner\nGET https://jsonplaceholder.typicode.com/users/{{owner}}\nHTTP 200\n[Asserts]\njsonpath \"$.name\" isString\n```",
  },
  { id: "secret", name: "Secret ({{name}}, kept in a locked secrets note)", md: "The token is {{qa-token}}, and {{no-such-secret}} isn't one." },
  {
    id: "requests",
    name: "API requests (http block): a variable, a named request and one using its response",
    md: "```http\n@api = https://jsonplaceholder.typicode.com\n\n### A todo\n# @name todo\nGET {{api}}/todos/1\n\n### Its owner\nGET {{api}}/users/{{todo.response.body.$.userId}}\n```",
  },
  { id: "spreadsheet", name: "Spreadsheet (csv block)", md: "```csv\nItem, Cost\nRent, 1200\nFood, 450.50\nTotal, =SUM(B2:B3)\n```" },
  {
    id: "spreadsheet-named",
    name: "Named spreadsheet (csv name=), and a formula in another block using it",
    md: "```csv name=costs\nItem, Cost, Day\nRent, $1200, 2026-01-05\n```\n\n```csv\nTotal, =costs!B2*2\n```",
  },
  { id: "divider", name: "Divider", md: "---" },
  { id: "key-value", name: "Key: Value line", md: "**Wi-Fi password:** correct-horse-battery" },
  { id: "mention", name: "Mention", md: "Ask @[QA · Ada] at @[QA · Ada].email." },
  { id: "wiki-link", name: "Wiki link", md: "Ask [[QA · Ada]], or [[QA · Ada|her]]." },
  {
    id: "symbols",
    name: "Symbols",
    md: "Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \\-> and `a -> b` in code.",
  },
  {
    id: "github",
    name: "GitHub links",
    md: "Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)",
  },
  { id: "image", name: "Image", md: "![A sample picture](attachment:photo.png)" },
  { id: "drawing", name: "Drawing", md: "![A sample drawing](attachment:drawing.svg)" },
  { id: "file", name: "File", md: "[Budget.csv](attachment:budget.csv)" },
  { id: "model-file", name: "Attached 3D model (STL)", md: "[Bracket.stl](attachment:bracket.stl)" },
  { id: "recording", name: "Terminal recording (.cast file)", md: "[terminal.cast](attachment:terminal.cast)" },
  { id: "missing-file", name: "Missing file", md: "[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)" },
  { id: "card", name: "Card", md: "::: card\nText in a card.\n:::" },
  { id: "callout", name: "Callout (info)", md: ":::i\nText in an info callout.\n:::" },
  { id: "callout-icon", name: "Callout (warning, chosen icon)", md: ":::! icon=flag\nText in a warning callout with the flag icon.\n:::" },
  { id: "callout-none", name: "Callout (decision, no icon)", md: ":::^ icon=none\nText in a decision callout with no icon.\n:::" },
];

/** Things other elements go inside. `wrap` puts an element's Markdown in one. */
const CONTAINERS = [
  { id: "top-level", name: "at the top level", wrap: (md) => md },
  { id: "card", name: "in a card", wrap: (md) => `::: card\n${md}\n:::` },
  { id: "callout", name: "in a callout", wrap: (md) => `:::i\n${md}\n:::` },
  { id: "callout-none", name: "in a callout with no icon", wrap: (md) => `:::^ icon=none\n${md}\n:::` },
  { id: "nested", name: "in a callout in a card", wrap: (md) => `::: card\n:::!\n${md}\n:::\n:::` },
  { id: "quote", name: "in a quote", wrap: (md) => md.replace(/^/gm, "> ").replace(/> $/gm, ">") },
  { id: "list", name: "in a list item", wrap: (md) => `- List item\n\n${md.replace(/^(?=.)/gm, "  ")}` },
];

/** Some things are only drawn at the top level and in cards; elsewhere they stay Markdown. */
const DRAWN = new Set(["diagram", "diagram-sized", "math", "table", "table-formulas", "spreadsheet", "spreadsheet-named", "image", "drawing", "file", "missing-file"]);
const DRAWN_ONLY_IN = new Set(["top-level", "card", "callout", "callout-none", "nested"]);

const notes = [];

function note(file, title, intro, sections, tag) {
  const body = [`# QA · ${title}`, "", intro, "", `#qa/${tag}`, "", ...sections.flatMap((section) => [section, ""])];
  notes.push({ file, text: body.join("\n").replace(/\n+$/, "\n") });
}

const label = (n, text) => `#### ${n}. ${text}`;

/* Inline styles, in every place text can be. */

const INLINE = [
  "**bold**",
  "*italic*",
  "***bold italic***",
  "~~struck~~",
  "==highlighted==",
  "<u>underlined</u>",
  "`code`",
  "[link](https://example.com)",
  "#qa/inline-tag",
  "@[QA · Ada]",
  "$e^{i\\pi} + 1 = 0$",
  "**bold with *italic* inside**",
  "==highlight with **bold** and `code`==",
  "**[bold link](https://example.com)**",
  "~~struck **bold**~~",
  "<u>underlined with **bold**</u>",
];
const inlineLine = INLINE.join(", ");
const INLINE_PLACES = [
  ["a paragraph", inlineLine],
  ["a heading", `## Heading with ${INLINE.slice(0, 7).join(", ")}`],
  ["a bullet", `- ${inlineLine}`],
  ["a todo", `- [ ] ${inlineLine}`],
  ["a done todo", `- [x] ${inlineLine}`],
  ["a quote", `> ${inlineLine}`],
  ["a table cell", `| Styles |\n| --- |\n| ${INLINE.filter((s) => !s.includes("|")).join(", ")} |`],
  ["a card", `::: card\n${inlineLine}\n:::`],
  ["a callout", `:::?\n${inlineLine}\n:::`],
  ["a Key: Value line", `**Styles:** ${INLINE.slice(0, 7).join(" ")}`],
];
note(
  "01-inline-styles.md",
  "Inline styles",
  "Each style alone and mixed, in each place text can be. Check: every style shows (bold, italic, strikethrough, highlight, underline, code, link, tag), its Markdown is hidden until the cursor is on the line, and nested styles combine.",
  INLINE_PLACES.map(([place, md], i) => `${label(i + 1, `In ${place}`)}\n\n${md}`),
  "inline",
);

/* Tags and highlights: where they start and stop. */

note(
  "02-tags-and-highlights.md",
  "Tags and highlights",
  "Edge cases for tags, highlights and underlines. Check each line against what it says should happen, and the tags in the sidebar under qa.",
  [
    `${label(1, "Tags")}\n\n- #qa/plain is a tag\n- #qa/nested/deeper is a nested tag\n- (#qa/in-brackets) is a tag\n- #qa/trailing-slash/ is a tag without the slash\n- #QA/Upper is the same tag as #qa/upper\n- #qa/café and #qa/日本 are tags\n- C# is not a tag\n- #123 is not a tag\n- [a link](#anchor) is not a tag\n- \`#qa/in-code\` is not a tag`,
    `${label(2, "Tags in code blocks")}\n\n\`\`\`\n#qa/not-a-tag in a code block\n\`\`\``,
    `${label(3, "Highlights")}\n\n- ==highlighted==\n- a == b is not a highlight\n- ===three equals=== is not a highlight\n- ==highlight across **bold** text==\n- == spaced == is not a highlight`,
    `${label(4, "Underlines")}\n\n- <u>underlined</u>\n- <U>underlined in capitals</U>\n- <u>underline across **bold** and ==highlighted== text</u>\n- **bold with <u>underlined</u> inside**\n- a lone <u> stays as typed\n- <u class="x">a tag with an attribute</u> is not an underline\n- \`<u>in code</u>\` is not an underline`,
  ],
  "tags",
);

/* Callouts: every kind, every way of writing one, nested and touching. */

const KINDS = [
  ["info", "i"],
  ["question", "?"],
  ["warning", "!"],
  ["error", "!!!"],
  ["decision", "^"],
];
const callouts = [];
let n = 0;
for (const [long, short] of KINDS) {
  const a = long === "info" || long === "error" ? `An ${long}` : `A ${long}`;
  callouts.push(
    `${label(++n, `${long}: short name, default icon`)}\n\n:::${short}\n${a} callout written \`:::${short}\`.\n:::`,
    `${label(++n, `${long}: long name with a space`)}\n\n::: ${long}\n${a} callout written \`::: ${long}\`.\n:::`,
    `${label(++n, `${long}: upper case`)}\n\n:::${long.toUpperCase()}\n${a} callout written in capitals.\n:::`,
    `${label(++n, `${long}: chosen icon`)}\n\n:::${short} icon=rocket\n${a} callout with the rocket icon.\n:::`,
    `${label(++n, `${long}: no icon`)}\n\n:::${short} icon=none\n${a} callout with no icon. The text starts at the card's edge.\n:::`,
  );
}
callouts.push(
  `${label(++n, "Unknown icon name: the kind's own icon")}\n\n:::! icon=no-such-icon\nShows the warning triangle.\n:::`,
  `${label(++n, "Unknown kind: a plain card")}\n\n:::tip\nA plain card, not a callout.\n:::`,
  `${label(++n, "Two exclamation marks: a plain card")}\n\n:::!!\nA plain card, not a callout.\n:::`,
  `${label(++n, "Several paragraphs")}\n\n:::i\nFirst paragraph.\n\nSecond paragraph, after a blank line.\n\nThird paragraph.\n:::`,
  `${label(++n, "Starts with a heading")}\n\n:::!\n## A heading first\nThe icon lines up with the heading's first line.\n:::`,
  `${label(++n, "Starts with a list")}\n\n:::^\n- First item\n- Second item\n:::`,
  `${label(++n, "Starts with a table")}\n\n:::i\n| A | B |\n| --- | --- |\n| 1 | 2 |\n:::`,
  `${label(++n, "Starts with a code block")}\n\n:::!!!\n\`\`\`\nerror: something broke\n\`\`\`\n:::`,
  `${label(++n, "Empty")}\n\n:::?\n:::`,
  `${label(++n, "Callout in a callout")}\n\n:::i\nOuter callout.\n\n:::!\nInner callout, inset inside the outer one with its own icon column.\n:::\n\nBack in the outer one.\n:::`,
  `${label(++n, "Card in a callout")}\n\n:::^\nA callout with a card inside.\n\n::: card\nThe card.\n:::\n:::`,
  `${label(++n, "Callout in a card")}\n\n::: card\nA card with a callout inside.\n\n:::?\nThe callout.\n:::\n:::`,
  `${label(++n, "Three callouts touching, no blank lines")}\n\n:::i\nFirst.\n:::\n:::!\nSecond.\n:::\n:::^\nThird.\n:::`,
  `${label(++n, "Very long word")}\n\n:::!\nSupercalifragilisticexpialidocious-and-then-some-more-text-without-any-spaces-to-break-at-all-anywhere\n:::`,
  `${label(++n, "Wide table")}\n\n:::i\n| One | Two | Three | Four | Five | Six | Seven | Eight |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| a long cell | another long cell | more | more | more | more | more | more |\n:::`,
);
note(
  "03-callouts.md",
  "Callouts",
  "Every kind of callout, every way of writing one, nested and touching. Check: the color and icon of each kind, the icon level with the first line, text clear of the icon, nothing spilling out of a callout, and the Markdown showing when the cursor is on a fence. Click an icon: the picker opens, and choosing an icon, No Icon or Reset rewrites that callout's first line.",
  callouts,
  "callouts",
);

/* Edge cases that don't fit elsewhere. */

note(
  "04-edge-cases.md",
  "Edge cases",
  "Unusual but valid Markdown. Check each against what it says should happen.",
  [
    `${label(1, "Four colons")}\n\n:::: card\nA card opened with four colons and closed with three.\n:::`,
    `${label(2, "Name with a colon: not a card")}\n\n::: note: this\nThis line and the fence above are plain text.`,
    `${label(3, "Empty card")}\n\n::: card\n:::`,
    `${label(4, "Card right after a code block")}\n\n\`\`\`\ncode\n\`\`\`\n::: card\nThe card leaves a gap above it.\n:::`,
    `${label(5, "Cards touching")}\n\n::: card\nFirst.\n:::\n::: card\nSecond, with a gap between.\n:::`,
    `${label(6, "Image inside a line of text")}\n\nText with ![a picture](attachment:photo.png) inside it.`,
    `${label(7, "Picture from the web")}\n\n![A memo emoji](https://github.githubassets.com/images/icons/emoji/unicode/1f4dd.png)`,
    `${label(8, "Empty lines between paragraphs")}\n\nOne.\n\n\n\nTwo, after three empty lines.`,
    `${label(9, "Setext heading")}\n\nText followed by dashes\n---`,
    `${label(10, "Hard line break")}\n\nLine with two trailing spaces  \nnext line.`,
    `${label(11, "HTML")}\n\n<b>HTML is shown as text</b>`,
    `${label(12, "Fence in a code block in a card")}\n\n::: card\n\`\`\`\n:::\n\`\`\`\nThe ::: in the code above doesn't close the card; this line is still in it.\n:::`,
    `${label(13, "Three cards closing on three lines, after a code block in a language not loaded yet")}\n\n\`\`\`haskell\nmain = putStrLn "hello"\n\`\`\`\n\n::: card\n:::!\n:::i\nThree cards, each inside the last. Check all three close here, and the next heading is outside them.\n:::\n:::\n:::`,
    `${label(14, "After the cards above")}\n\nThis line is outside every card.`,
    `${label(15, "Photo from Unsplash, by the link to its page")}\n\n![Snow-covered mountain peak](https://unsplash.com/photos/snow-covered-mountain-peak-illuminated-by-sunset-light-mevyYnC5xCo)`,
    `${label(16, "Unsplash photo inside a line of text")}\n\nA mountain ![ice-capped mountain](https://unsplash.com/photos/xfngap_DToE) inside a line.`,
    `${label(17, "Dollars that aren't math")}\n\n- $5 and $10 stay text (a space before the second $, a digit after it).\n- An escaped \\$x\\$ stays text.\n- \`$x$\` in code stays code.`,
    `${label(18, "Math that isn't Markdown")}\n\n$a_1 * b_2 * c_3$ is math, with no italics.`,
    `${label(19, "Display math within a paragraph")}\n\nThe Basel problem: $$\\sum_{n=1}^\\infty \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$ centered on a line of its own.`,
    `${label(20, "LaTeX that KaTeX can't read")}\n\nShown red, as written, with the reason on hover: $\\frac{1}{$\n\n$$\n\\begin{matrix} a\n$$`,
    `${label(21, "Math code block")}\n\n\`\`\`math\n\\begin{aligned}\na &= b + c \\\\\nd &= e\n\\end{aligned}\n\`\`\``,
    `${label(22, "Empty math block")}\n\n$$\n$$`,
    `${label(23, "A line of only #")}\n\n#\n\nThe # above is text, not an empty heading; a tag is typed this way.`,
    `${label(24, "Recording from asciinema.org, by its embed code")}\n\n[![asciicast](https://asciinema.org/a/1271559.svg)](https://asciinema.org/a/1271559)`,
    `${label(25, "asciinema's preview alone plays too")}\n\n![asciicast](https://asciinema.org/a/1271559.png)`,
    `${label(26, "Starting at 0:10, twice as fast")}\n\n[![asciicast](https://asciinema.org/a/1271559.svg)](https://asciinema.org/a/1271559?t=0:10&speed=2)`,
    `${label(27, "Recordings that stay links")}\n\n[A recording's page](https://asciinema.org/a/1271559) and [terminal.cast](attachment:terminal.cast) within a line of text are links.`,
  ],
  "edge-cases",
);

// Its title has to come from inside its first callout, so it starts with one.
notes.push({
  file: "05-title-from-a-callout.md",
  text: `:::i\nQA · Title from a callout\n:::\n\nIn the note list this note is called "QA · Title from a callout": the fence above is skipped.\n\n#qa/edge-cases\n`,
});

note(
  "06-unclosed-card.md",
  "Unclosed card",
  "The card below is never closed, so it runs to the end of the note. Check it ends cleanly at the bottom.",
  [":::!\nThis callout has no closing fence.\n\n- It holds everything after it\n- Down to the end of the note"],
  "edge-cases",
);

note(
  "07-unclosed-code-block.md",
  "Unclosed code block",
  "The code block below is never closed, so it runs to the end of the note. Check it ends cleanly at the bottom.",
  ["```\nThis code block has no closing fence.\n\n#qa/not-a-tag stays code"],
  "edge-cases",
);

note(
  "08-github-links.md",
  "GitHub links",
  "Each kind of GitHub link. Check: each one shows as written in code after the arrow, with GitHub's mark, and shows its URL while the cursor is on it; ⌘-click opens it. A link with text of its own keeps its text, with the mark in front.",
  [
    `${label(1, "Bare URLs")}\n\n${[
      ["https://github.com/overtio", "@overtio"],
      ["https://github.com/overtio/lines", "overtio/lines"],
      ["https://github.com/overtio/lines.git", "overtio/lines"],
      ["https://github.com/overtio/lines/issues/12", "overtio/lines#12"],
      ["https://github.com/overtio/lines/pull/34/files", "overtio/lines#34"],
      ["https://github.com/overtio/lines/discussions/5", "overtio/lines#5"],
      ["https://github.com/overtio/lines/commit/6781dd7f00ba", "overtio/lines@6781dd7"],
      ["https://github.com/overtio/lines/pull/34/commits/abcdef1234567", "overtio/lines@abcdef1"],
      ["https://github.com/overtio/lines/tree/main", "overtio/lines@main"],
      ["https://github.com/overtio/lines/releases/tag/v1.0.0", "overtio/lines@v1.0.0"],
      ["https://github.com/overtio/lines/compare/v1.0...main", "overtio/lines@v1.0...main"],
      ["https://github.com/overtio/lines/blob/main/src/lib/editor/github.ts#L10-L20", "overtio/lines › github.ts:10-20"],
      ["https://github.com/overtio/lines/tree/main/docs", "overtio/lines › docs"],
      ["https://github.com/overtio/lines/actions", "overtio/lines › actions"],
      ["www.github.com/overtio/lines", "overtio/lines"],
    ]
      .map(([url, short]) => `- ${url} → \`${short}\``)
      .join("\n")}`,
    `${label(2, "Other ways of writing them")}\n\n- <https://github.com/overtio/lines/issues/3> (angle brackets) → \`overtio/lines#3\`\n- [https://github.com/overtio/lines/issues/4](https://github.com/overtio/lines/issues/4) (text is the URL) → \`overtio/lines#4\`\n- [the parser bug](https://github.com/overtio/lines/issues/7) → the mark, then "the parser bug"`,
    `${label(3, "Not shortened")}\n\n- https://github.com stays a plain link\n- https://github.com/settings/profile stays a plain link\n- https://gist.github.com/overtio/1 stays a plain link\n- https://example.com/overtio/lines stays a plain link\n- \`https://github.com/overtio/lines\` in code stays code`,
    `${label(4, "In a table")}\n\n| Link | Shows |\n| --- | --- |\n| https://github.com/overtio/lines/issues/12 | \`overtio/lines#12\` |\n| [docs](https://github.com/overtio/lines/tree/main/docs) | the mark, then docs |`,
  ],
  "github",
);

/* Objects (notes/properties.ts): two notes with properties, and mentions of them. */

notes.push(
  {
    file: "17-object-person.md",
    text: [
      "---",
      "type: qa-person",
      "fullname: Ada Lovelace",
      "email: ada@example.org",
      "Born on: 10 December 1815",
      "employer: @[QA · Company]",
      'motto: "That brain of mine is something more than merely mortal"',
      "languages:",
      "  - English",
      "  - French",
      "# a YAML comment, ignored",
      "---",
      "# QA · Ada",
      "",
      "A note with properties, of the type qa-person. Check: the properties show as a column of keys and their values, with its type's icon before qa-person (shapes, until one is chosen) and a line under them; the `---` lines show only while the cursor is in them; the employer is a chip that ⌘-click opens; hovering a value shows a copy button. In the list this note is called \"QA · Ada\", and the sidebar lists Qa-person under Types.",
      "",
      "#qa/objects",
      "",
    ].join("\n"),
  },
  {
    file: "18-object-company.md",
    text: "---\ntype: qa-company\nwebsite: https://example.com\nfounded: 1843\n---\n# QA · Company\n\nAnother object, of the type qa-company. Check: right-click Qa-company in the sidebar and change its icon; it changes here, in the list, and on every mention of this note.\n\n#qa/objects\n",
  },
);

note(
  "19-mentions.md",
  "Mentions",
  "Mentions of other notes and their properties. Check each line against what it says should happen. ⌘-click a chip or a value to open its note; with the cursor on a mention it shows as written.",
  [
    `${label(1, "Mentions")}\n\n- @[QA · Ada] is a chip with its type's icon and "QA · Ada"\n- @[qa · ada] and @[QA  ·  Ada] are the same chip (case and spaces don't matter)\n- @[QA · Company] has the icon of its type, qa-company`,
    `${label(2, "Properties")}\n\n- @[QA · Ada].fullname reads "Ada Lovelace", underlined\n- @[QA · Ada].born_on and @[QA · Ada].bornOn both read "10 December 1815" (the key is "Born on")\n- @[QA · Ada].employer reads "QA · Company"\n- @[QA · Ada].languages reads "English, French"\n- @[QA · Ada].motto reads without its quotes`,
    `${label(3, "Not found")}\n\n- @[No such note] stays as written, grey with a dashed underline; hovering it offers to create it (don't, so the line stays a test)\n- @[QA · Ada].phone stays as written: Ada has no phone`,
    `${label(4, "Not mentions")}\n\n- ada@example.org is an email address\n- overtio/lines@main is not a mention\n- \\@[QA · Ada] (escaped) stays text\n- \`@[QA · Ada]\` in code stays code\n- A sentence ending after @[QA · Ada]. The full stop isn't a property: typing it opens the properties menu, and Enter then starts a new line.`,
    `${label(5, "Type tables")}\n\nEvery note of the type qa-person, with every property:\n\n@type.qa-person\n\nJust two columns:\n\n@type.qa-person(fullname, email)\n\nA type with no notes:\n\n@type.qa-nothing\n\nWithin text, @type.qa-person is a chip.`,
    `${label(6, "Typing")}\n\nType @ and a letter on the line below: a menu of notes opens, with types on the right. Enter or Tab writes the mention. Then type . for a menu of its properties.\n\n`,
    `${label(7, "Wiki links")}\n\n- [[QA · Ada]] is the same chip as @[QA · Ada]\n- [[QA · Ada|her]] reads "her", with Ada's icon; hovering it shows "QA · Ada"\n- [[QA · Ada#Born]] is Ada's chip (the heading is read past)\n- [[No such note]] stays as written, grey with a dashed underline, and offers to create it on hover (don't)\n- ![[QA · Ada]] (an embed) and \\[[QA · Ada]] (escaped) stay text\n\nType two opening square brackets on the line below: the menu of notes opens at once, and Enter writes the wiki link.\n\n`,
  ],
  "objects",
);

/* Every element in every container. */

CONTAINERS.forEach((container, c) => {
  const sections = ELEMENTS.map((element, i) => {
    const plain = DRAWN.has(element.id) && !DRAWN_ONLY_IN.has(container.id) ? " (stays Markdown here)" : "";
    return `${label(i + 1, `${element.name} ${container.name}${plain}`)}\n\n${container.wrap(element.md)}`;
  });
  note(
    `${String(10 + c).padStart(2, "0")}-${container.id}.md`,
    `Everything ${container.name}`,
    `Each element ${container.name}. Check: it draws as it does on its own, sits inside the container's edges with even space around it, and its Markdown shows while the cursor is in it. Tables, spreadsheets, diagrams and attachments in quotes and list items stay as Markdown.`,
    sections,
    "containers",
  );
});

/* Every element right after every other, with no blank line between. */

ELEMENTS.forEach((first, f) => {
  const sections = ELEMENTS.map((second, i) => `${label(i + 1, `${first.name}, then ${second.name}`)}\n\n${first.md}\n${second.md}`);
  note(
    `${String(20 + f).padStart(2, "0")}-after-${first.id}.md`,
    `Right after: ${first.name}`,
    `${first.name} followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.`,
    sections,
    "adjacent",
  );
});

/* A note written in LaTeX (docs/latex.md), with everything lines draws in one. */

const LATEX = [
  ["Headings", "\\subsection{A subsection}\n\\subsubsection*{A starred subsubsection}"],
  ["Styles", "\\textbf{bold}, \\textit{italic}, \\emph{emphasis}, \\texttt{code}, \\underline{underlined}, \\textsc{Small Caps}, \\textbf{bold with \\emph{emphasis} inside}."],
  ["Characters", "50\\% of \\$10 \\& \\#1, a~tie, en--dash, em---dash, ``quoted'', and so on\\ldots{} \\LaTeX."],
  ["Lists", "\\begin{itemize}\n  \\item First\n  \\item Second\n  \\begin{enumerate}\n    \\item Nested, numbered\n    \\item Again\n  \\end{enumerate}\n  \\item[--] Its own marker\n\\end{itemize}\n\n\\begin{description}\n  \\item[Term] Its description.\n\\end{description}"],
  ["Math", "Inline $e^{i\\pi} + 1 = 0$ and \\(a^2 + b^2 = c^2\\).\n\n\\[ \\sum_{n=1}^\\infty \\frac{1}{n^2} = \\frac{\\pi^2}{6} \\]\n\n\\begin{equation}\n  \\int_0^1 x^2\\,dx = \\frac{1}{3} \\label{eq:integral}\n\\end{equation}\n\n\\begin{align*}\n  a &= b + c \\\\\n  d &= e\n\\end{align*}"],
  ["Broken math", "Red, as written, with the reason on hover: $\\frac{1}{$"],
  ["Table", "\\begin{tabular}{|l|c|r|}\n  \\hline\n  Left & Center & Right \\\\\n  \\hline\n  a & $x^2$ & 1 \\\\\n  longer cell & b & 22 \\\\\n  \\hline\n\\end{tabular}"],
  ["Quote and centered", "\\begin{quote}\nA quote.\n\\end{quote}\n\n\\begin{center}\nCentered text.\n\\end{center}"],
  ["Code", "\\begin{verbatim}\nraw \\textbf{not bold} $not math$\n\\end{verbatim}"],
  ["Links and footnotes", "A \\href{https://example.com}{named link}, a bare \\url{https://example.com}, and a footnote.\\footnote{The footnote's text.}"],
  ["Comments and other commands", "Text % a comment with #qa/latex-tag\n\\maketitle \\vspace{1em} \\label{x} stay faint."],
  ["Line break", "First line\\\\\nsecond line."],
  ["Theorems", "\\newtheorem{lem}[theorem]{Lemma}\n\n\\begin{lem}[Small]\nA lemma, numbered along with theorems: Lemma 1.\n\\end{lem}\n\n\\begin{theorem}\nTheorem 2, with math in its frame:\n\\[ a^2 + b^2 = c^2 \\]\n\\end{theorem}\n\n\\begin{proof}\nItalic Proof., and a box at the end.\n\\end{proof}"],
  ["Citations and references", "As shown in \\cite{knuth1984, lamport1994} and Section~\\ref{sec:intro}, see \\eqref{eq:one}. \\label{qa:hidden} The label before this is hidden."],
  ["Own math commands", "\\newcommand{\\R}{\\mathbb{R}}\n\\newcommand{\\abs}[1]{\\left\\lvert #1 \\right\\rvert}\n\\DeclareMathOperator{\\sinc}{sinc}\nDrawn with the note's commands: $\\abs{x} \\in \\R$ and $\\sinc x$."],
  ["Accents, letters, verb", "Gödel, Erdős, Łukasiewicz, façade: G\\\"odel, Erd\\H{o}s, \\L ukasiewicz, fa\\c{c}ade. Code: \\verb|x = {a & b}|."],
  ["Nested numbering", "\\begin{enumerate}\n  \\item One\n  \\begin{enumerate}\n    \\item (a)\n    \\begin{enumerate}\n      \\item i.\n    \\end{enumerate}\n  \\end{enumerate}\n\\end{enumerate}"],
  ["Bibliography", "\\begin{thebibliography}{9}\n\\bibitem{knuth1984} D. Knuth, \\emph{The \\TeX book}, 1984.\n\\bibitem{lamport1994} L. Lamport, \\emph{\\LaTeX: A Document Preparation System}, 1994.\n\\end{thebibliography}"],
  ["Not closed", "\\textbf{never closed, and \\begin{itemize} with no end: shown as written."],
];
notes.push({
  file: "09-latex.tex",
  text: [
    "\\section{QA · LaTeX note}",
    "% #qa/latex",
    "",
    "A note written in LaTeX. Check: each construct is drawn as its heading says, its LaTeX shows while the cursor is on it, and the title in the list is \"QA · LaTeX note\".",
    "",
    ...LATEX.flatMap(([name, latex], i) => [`\\paragraph{${i + 1}. ${name}}`, "", latex, ""]),
  ].join("\n"),
});

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const { file, text } of notes) writeFileSync(join(OUT, file), text);
console.log(`Wrote ${notes.length} notes to ${OUT}: ${readdirSync(OUT).length} files.`);
