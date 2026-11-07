import type { Note } from "../lib/notes/types";

/*
 * A library to measure lines with: thousands of everyday notes, and the big ones that show where
 * it slows down. The same every time (a seeded random), so runs compare.
 */

const WORDS = (
  "garden window morning river coffee letter market winter summer budget meeting project recipe travel " +
  "station library kitchen planet music guitar mountain island harbor forest pencil notebook evening " +
  "weekend holiday ticket museum bridge castle village candle lantern meadow orchard bakery theatre " +
  "journal sketch puzzle compass anchor feather marble velvet copper silver amber cedar maple willow " +
  "thunder breeze shadow sunrise harvest valley canyon desert glacier lagoon prairie tundra savanna"
).split(" ");
const TAGS = ["work", "home", "ideas", "reading", "travel/italy", "travel/japan", "recipes", "health", "money", "people"];

/** A small, seeded random number generator (mulberry32). */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = () => number;
const pick = <T>(rng: Random, list: T[]) => list[Math.floor(rng() * list.length)];
const words = (rng: Random, n: number) => Array.from({ length: n }, () => pick(rng, WORDS)).join(" ");
const sentence = (rng: Random) => {
  const text = words(rng, 6 + Math.floor(rng() * 12));
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
};
const paragraph = (rng: Random) => Array.from({ length: 2 + Math.floor(rng() * 4) }, () => sentence(rng)).join(" ");
const title = (rng: Random) => {
  const text = words(rng, 2 + Math.floor(rng() * 3));
  return `${text[0].toUpperCase()}${text.slice(1)}`;
};

function table(rng: Random, rows: number) {
  const lines = ["| Item | Count | Price | Total |", "| :--- | ----: | ----: | ----: |"];
  for (let r = 2; r < rows + 2; r++) lines.push(`| ${title(rng)} | ${1 + Math.floor(rng() * 9)} | ${(rng() * 90 + 5).toFixed(2)} | =B${r}*C${r} |`);
  lines.push(`| Total | =SUM(B2:B${rows + 1}) | | =SUM(D2:D${rows + 1}) |`);
  return lines.join("\n");
}

/** A note of the kind people write every day: a title, some paragraphs, a list, maybe a table or code. */
function everydayNote(rng: Random) {
  const parts = [`# ${title(rng)}`, "", paragraph(rng)];
  const kind = rng();
  if (kind < 0.35) parts.push("", ...Array.from({ length: 3 + Math.floor(rng() * 6) }, () => `- ${sentence(rng)}`));
  else if (kind < 0.55) parts.push("", ...Array.from({ length: 3 + Math.floor(rng() * 5) }, () => `- [${rng() < 0.4 ? "x" : " "}] ${words(rng, 4)}`));
  else if (kind < 0.65) parts.push("", table(rng, 4));
  else if (kind < 0.72) parts.push("", "```ts", `const ${pick(rng, WORDS)} = ${Math.floor(rng() * 100)};`, "```");
  for (let i = Math.floor(rng() * 4); i > 0; i--) parts.push("", paragraph(rng));
  parts.push("", `#${pick(rng, TAGS)}`);
  const body = parts.join("\n");
  return rng() < 0.05 ? `---\ntype: person\nborn: ${1900 + Math.floor(rng() * 100)}\n---\n${body}` : body;
}

/** A long Markdown note with every kind of block in it, `lines` lines long. */
export function longMarkdown(lines: number, seed = 7) {
  const rng = random(seed);
  const out = [`# Long note ${lines}`, ""];
  for (let section = 1; out.length < lines; section++) {
    out.push(`## Section ${section}`, "", paragraph(rng), "");
    out.push(...Array.from({ length: 5 }, () => `- ${sentence(rng)}`), "");
    out.push(...Array.from({ length: 3 }, () => `- [ ] ${words(rng, 5)}`), "");
    if (section % 2 === 0) out.push(table(rng, 5), "");
    if (section % 3 === 0) out.push("```js", `function ${pick(rng, WORDS)}(a, b) {`, "  return a + b;", "}", "```", "");
    if (section % 5 === 0) out.push("$$", `\\sum_{i=1}^{${section}} i^2 = \\frac{n(n+1)(2n+1)}{6}`, "$$", "");
    if (section % 7 === 0) out.push(":::i", paragraph(rng), ":::", "");
    if (section % 11 === 0) out.push("```csv", "Month, Spent", "January, $820", "February, $760", "Total, =SUM(B2:B3)", "```", "");
    if (section % 40 === 0) out.push("```mermaid", "flowchart LR", "  A --> B --> C", "```", "");
    out.push(paragraph(rng), "", `Key ${section}: value ${section}`, "");
  }
  return out.join("\n");
}

/** A long LaTeX note: sections, math, lists and tables. */
export function longLatex(lines: number, seed = 11) {
  const rng = random(seed);
  const out = [`\\section{Long LaTeX ${lines}}`, ""];
  for (let section = 1; out.length < lines; section++) {
    out.push(`\\subsection{Part ${section}}`, "", `${paragraph(rng)} With $x_${section}^2 + y = \\alpha$ in it.`, "");
    out.push("\\begin{itemize}", ...Array.from({ length: 3 }, () => `  \\item ${sentence(rng)}`), "\\end{itemize}", "");
    if (section % 3 === 0) out.push("\\begin{align*}", `  f(x) &= \\int_0^{${section}} e^{-t} \\, dt \\\\`, "  g(x) &= \\frac{1}{x}", "\\end{align*}", "");
    if (section % 4 === 0) out.push("\\begin{tabular}{lr}", "  Name & Value \\\\", "  \\hline", `  ${pick(rng, WORDS)} & ${section} \\\\`, "\\end{tabular}", "");
  }
  return out.join("\n");
}

/** A spreadsheet note of `rows` rows: dates, text, money, numbers and a formula on each. */
export function bigSheet(rows: number, seed = 13) {
  const rng = random(seed);
  const out = [`Big sheet ${rows}`, "", "Date,Item,Price,Count,Total,Note"];
  const start = Date.UTC(2026, 0, 1);
  for (let r = 2; r < rows + 2; r++) {
    const date = new Date(start + (r - 2) * 86_400_000).toISOString().slice(0, 10);
    out.push(`${date},${title(rng)},$${(rng() * 200).toFixed(2)},${Math.floor(rng() * 20)},=C${r}*D${r},${words(rng, 3)}`);
  }
  return out.join("\n");
}

/** The notes the benchmarks open by name, pinned so they're at the top of the list. */
export const SPECIAL = {
  typical: "Typical note",
  long: "Long note 3000",
  huge: "Long note 12000",
  latex: "Long LaTeX 3000",
  sheet: "Big sheet 3000",
} as const;

/** `count` everyday notes (some LaTeX and spreadsheets among them), and the special ones. */
export function library(count: number): Note[] {
  const rng = random(1);
  const now = Date.now();
  const note = (body: string, i: number, extra: Partial<Note> = {}): Note => ({
    id: crypto.randomUUID(),
    body,
    createdAt: now - i * 60_000,
    updatedAt: now - i * 60_000,
    pinned: false,
    trashed: false,
    ...extra,
  });
  const notes = Array.from({ length: count }, (_, i) => {
    if (i % 100 === 50) return note(longLatex(40, i), i + 10, { format: "latex" });
    if (i % 100 === 99) return note(bigSheet(20, i), i + 10, { format: "spreadsheet" });
    return note(everydayNote(rng), i + 10);
  });
  const typical = `# ${SPECIAL.typical}\n\n${everydayNote(random(3)).split("\n").slice(1).join("\n")}\n\n${table(random(4), 5)}\n\n${paragraph(random(5))}`;
  return [
    note(typical, 0, { pinned: true }),
    note(longMarkdown(3000), 1, { pinned: true }),
    note(longMarkdown(12000), 2, { pinned: true }),
    note(longLatex(3000), 3, { pinned: true, format: "latex" }),
    note(bigSheet(3000), 4, { pinned: true, format: "spreadsheet" }),
    ...notes,
  ];
}
