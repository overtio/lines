import { FENCE_START } from "../../lib/imports/markdown";

/*
 * A Logseq page as Logseq writes it: an outline, every line a block (`- …`), blocks under blocks
 * by their indent, a block's own lines under its first, and `key:: value` properties, the page's at
 * its top and a block's under its first line. Read into blocks, then written as lines writes notes:
 * a list where the page is a list, and paragraphs where it's clearly prose (docs/importing.md#logseq).
 */

/** A block: its first line, its lines after it, its properties (in order, as written), and the blocks under it. */
export interface Block {
  first: string;
  more: string[];
  properties: [key: string, value: string][];
  children: Block[];
}

export interface Page {
  /** The page's properties, written at its top. */
  properties: [key: string, value: string][];
  /** Lines at its top that aren't in a block (a page written by hand, or another app). */
  loose: string[];
  blocks: Block[];
}

const PROPERTY = /^([\p{L}\p{N}_][\p{L}\p{N}_-]*):: ?(.*)$/u;
const BULLET = /^([ \t]*)-(?:[ \t]+(.*))?$/;

/** A Logseq page's text as its properties and blocks. */
export function readPage(text: string): Page {
  const lines = text.split("\n");
  const page: Page = { properties: [], loose: [], blocks: [] };
  let i = 0;
  for (; i < lines.length && !BULLET.test(lines[i]); i++) {
    const property = PROPERTY.exec(lines[i].trim());
    if (property) page.properties.push([property[1], property[2].trim()]);
    else if (lines[i].trim() || page.loose.length) page.loose.push(lines[i]);
  }
  /** The blocks still open, each with its indent: the last is where a line goes. */
  const open: { indent: string; block: Block }[] = [];
  let fence = "";
  for (; i < lines.length; i++) {
    const line = lines[i];
    const bullet = !fence && BULLET.exec(line);
    const current = open.at(-1);
    if (bullet) {
      while (open.length && open.at(-1)!.indent.length >= bullet[1].length) open.pop();
      const block: Block = { first: bullet[2] ?? "", more: [], properties: [], children: [] };
      (open.at(-1)?.block.children ?? page.blocks).push(block);
      open.push({ indent: bullet[1], block });
      fence = FENCE_START.exec(block.first)?.[1] ?? "";
      continue;
    }
    if (!current) {
      page.loose.push(line);
      continue;
    }
    // Its lines are indented as its text: past its bullet's indent and `- `.
    const own = line.startsWith(current.indent) ? line.slice(current.indent.length).replace(/^ {0,2}/, "") : line.trimStart();
    const property = !fence && !current.block.more.length && PROPERTY.exec(own.trim());
    if (property) current.block.properties.push([property[1], property[2].trim()]);
    else current.block.more.push(own);
    const opening = FENCE_START.exec(own);
    if (opening) fence = fence ? (opening[1][0] === fence[0] && opening[1].length >= fence.length ? "" : fence) : opening[1];
  }
  // A page's properties written as its first block, as older versions did.
  const first = page.blocks[0];
  if (!page.properties.length && first && PROPERTY.test(first.first) && !first.children.length) {
    page.properties = [first.first, ...first.more].flatMap((line) => {
      const property = PROPERTY.exec(line.trim());
      return property ? [[property[1], property[2].trim()] as [string, string]] : [];
    });
    page.properties.push(...first.properties);
    page.blocks.shift();
  }
  return page;
}

/** Logseq's tasks: the word a block starts with, and whether it's done. */
const TASK = /^(TODO|LATER|DOING|NOW|WAITING|WAIT|IN-PROGRESS|DONE|CANCELED|CANCELLED)\s+/;
const HEADING = /^#{1,6}\s/;

/** How a block's text is written, and what the page needs told of it. */
export interface Written {
  /** A block's properties lines has nothing for, kept as text (`owner:: Ada`). */
  property(block: Block, key: string, value: string): void;
  /** A task in a state lines has no box for (`DOING`), kept as a word. */
  task(state: string, text: string): void;
}

/** A block's properties, as kept in its text: but its id (what refers to it) and whether it's folded, which are Logseq's. */
const shownProperties = (block: Block) => block.properties.filter(([key]) => key !== "id" && key !== "collapsed");

/** A block that's a paragraph of prose: a sentence or more, alone, with nothing under it, not a task. */
const isParagraph = (block: Block) =>
  !block.children.length && !TASK.test(block.first) && !shownProperties(block).length && !/^[!|>]|^```|^\$\$/.test(block.first) && block.first.trim().length >= 40 && /[.!?:;"”’)]$/.test([block.first, ...block.more].join(" ").trim());

/**
 * Whether blocks side by side are clearly prose: each a paragraph (headings aside), or a page of one
 * block with nothing under it. Otherwise they're an outline, kept as a list.
 */
function isProse(blocks: Block[]) {
  const text = blocks.filter((block) => !HEADING.test(block.first));
  if (text.length === 1 && !text[0].children.length && !TASK.test(text[0].first) && !shownProperties(text[0]).length) return true;
  return text.length > 0 && text.every(isParagraph);
}

/** A block's first line as lines writes it: its task as a box, a state lines hasn't got as a word after it. */
function firstLine(block: Block, written: Written) {
  const task = TASK.exec(block.first);
  if (!task) return block.first;
  const text = block.first.slice(task[0].length);
  const state = task[1];
  if (state === "TODO" || state === "LATER") return `[ ] ${text}`;
  if (state === "DONE") return `[x] ${text}`;
  written.task(state, text);
  if (state === "CANCELED" || state === "CANCELLED") return `[x] ~~${text}~~`;
  return `[ ] ${state} ${text}`;
}

/** A block's lines after its first: its properties lines has nothing for, as written, then the rest. */
function moreLines(block: Block, written: Written) {
  const properties = shownProperties(block);
  for (const [key, value] of properties) written.property(block, key, value);
  return [...properties.map(([key, value]) => `${key}:: ${value}`), ...block.more];
}

/** Blocks as a list, nested as they are, two spaces a level. */
function list(blocks: Block[], written: Written, depth = 0): string[] {
  const indent = "  ".repeat(depth);
  return blocks.flatMap((block) => {
    if (isEmpty(block)) return [];
    const first = firstLine(block, written);
    // A box goes right after the bullet, the rest of the line after it.
    return [`${indent}- ${first}`, ...moreLines(block, written).map((line) => (line ? `${indent}  ${line}` : "")), ...list(block.children, written, depth + 1)];
  });
}

/** Blocks at a page's top: headings as headings with what's under them after, then each run between them as prose or a list. */
function section(blocks: Block[], written: Written): string[] {
  const out: string[] = [];
  let run: Block[] = [];
  const flush = () => {
    if (!run.length) return;
    if (isProse(run)) for (const block of run) out.push([block.first, ...moreLines(block, written)].join("\n"), "");
    else out.push(...list(run, written), "");
    run = [];
  };
  for (const block of blocks) {
    if (!HEADING.test(block.first) || shownProperties(block).length) {
      run.push(block);
      continue;
    }
    flush();
    out.push([block.first, ...block.more].join("\n"), "");
    out.push(...section(block.children, written));
  }
  flush();
  return out;
}

/** A page's blocks as lines writes a note's text, but its title and properties. */
export function writePage(page: Page, written: Written): string {
  const text = [...(page.loose.length ? [...page.loose, ""] : []), ...section(page.blocks, written)];
  return text.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** A block with nothing in it, nor under it: Logseq leaves one where nothing's been written yet. */
export const isEmpty = (block: Block): boolean => !block.first.trim() && !block.more.some((line) => line.trim()) && block.children.every(isEmpty);

/** Every block of a page, those under others too. */
export function* blocksOf(blocks: Block[]): Generator<Block> {
  for (const block of blocks) {
    yield block;
    yield* blocksOf(block.children);
  }
}
