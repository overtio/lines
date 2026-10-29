// Writes the QA notes in qa/notes/: every Linedown element on its own, inside every container, and
// right after every other element, plus inline styles, callouts and edge cases. A QA engineer adds
// them to lines (Settings → Data → Add QA Notes) and looks through each before a release; see
// qa/README.md.
//
// When a feature adds something that can appear in a note, add it to ELEMENTS (and to CONTAINERS
// if other things can go inside it), then run `pnpm qa-notes` and commit the notes it writes.

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
    md: "A paragraph with **bold**, *italic*, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.",
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
  {
    id: "table",
    name: "Table",
    md: "| Left | Center | Right |\n| :--- | :----: | ----: |\n| a | **b** | 1 |\n| longer cell text | `code` | 22 |",
  },
  { id: "divider", name: "Divider", md: "---" },
  { id: "key-value", name: "Key: Value line", md: "**Wi-Fi password:** correct-horse-battery" },
  { id: "image", name: "Image", md: "![A sample picture](attachment:photo.png)" },
  { id: "file", name: "File", md: "[Budget.csv](attachment:budget.csv)" },
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
const DRAWN = new Set(["diagram", "table", "image", "file", "missing-file"]);
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
  "`code`",
  "[link](https://example.com)",
  "#qa/inline-tag",
  "**bold with *italic* inside**",
  "==highlight with **bold** and `code`==",
  "**[bold link](https://example.com)**",
  "~~struck **bold**~~",
];
const inlineLine = INLINE.join(", ");
const INLINE_PLACES = [
  ["a paragraph", inlineLine],
  ["a heading", `## Heading with ${INLINE.slice(0, 6).join(", ")}`],
  ["a bullet", `- ${inlineLine}`],
  ["a todo", `- [ ] ${inlineLine}`],
  ["a done todo", `- [x] ${inlineLine}`],
  ["a quote", `> ${inlineLine}`],
  ["a table cell", `| Styles |\n| --- |\n| ${INLINE.filter((s) => !s.includes("|")).join(", ")} |`],
  ["a card", `::: card\n${inlineLine}\n:::`],
  ["a callout", `:::?\n${inlineLine}\n:::`],
  ["a Key: Value line", `**Styles:** ${INLINE.slice(0, 6).join(" ")}`],
];
note(
  "01-inline-styles.md",
  "Inline styles",
  "Each style alone and mixed, in each place text can be. Check: every style shows (bold, italic, strikethrough, highlight, code, link, tag), its Markdown is hidden until the cursor is on the line, and nested styles combine.",
  INLINE_PLACES.map(([place, md], i) => `${label(i + 1, `In ${place}`)}\n\n${md}`),
  "inline",
);

/* Tags and highlights: where they start and stop. */

note(
  "02-tags-and-highlights.md",
  "Tags and highlights",
  "Edge cases for tags and highlights. Check each line against what it says should happen, and the tags in the sidebar under qa.",
  [
    `${label(1, "Tags")}\n\n- #qa/plain is a tag\n- #qa/nested/deeper is a nested tag\n- (#qa/in-brackets) is a tag\n- #qa/trailing-slash/ is a tag without the slash\n- #QA/Upper is the same tag as #qa/upper\n- #qa/café and #qa/日本 are tags\n- C# is not a tag\n- #123 is not a tag\n- [a link](#anchor) is not a tag\n- \`#qa/in-code\` is not a tag`,
    `${label(2, "Tags in code blocks")}\n\n\`\`\`\n#qa/not-a-tag in a code block\n\`\`\``,
    `${label(3, "Highlights")}\n\n- ==highlighted==\n- a == b is not a highlight\n- ===three equals=== is not a highlight\n- ==highlight across **bold** text==\n- == spaced == is not a highlight`,
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

/* Every element in every container. */

CONTAINERS.forEach((container, c) => {
  const sections = ELEMENTS.map((element, i) => {
    const plain = DRAWN.has(element.id) && !DRAWN_ONLY_IN.has(container.id) ? " (stays Markdown here)" : "";
    return `${label(i + 1, `${element.name} ${container.name}${plain}`)}\n\n${container.wrap(element.md)}`;
  });
  note(
    `${String(10 + c).padStart(2, "0")}-${container.id}.md`,
    `Everything ${container.name}`,
    `Each element ${container.name}. Check: it draws as it does on its own, sits inside the container's edges with even space around it, and its Markdown shows while the cursor is in it. Tables, diagrams and attachments in quotes and list items stay as Markdown.`,
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

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const { file, text } of notes) writeFileSync(join(OUT, file), text);
console.log(`Wrote ${notes.length} notes to ${OUT}: ${readdirSync(OUT).length} files.`);
