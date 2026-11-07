import type { BlockContext, InlineContext, Line, MarkdownConfig } from "@lezer/markdown";
import { tags as t } from "@lezer/highlight";
import { TAG_CHAR } from "../notes/parse";

const HASH = 35, EQUALS = 61, SLASH = 47, OPEN_PAREN = 40;

function isSpace(code: number) {
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 160;
}

function charBefore(cx: InlineContext, pos: number) {
  return pos === cx.offset ? -1 : cx.char(pos - 1);
}

/**
 * Bear-style `#tag` and `#nested/tag`. A line of only `#` is where one is being typed, so it's text
 * rather than an empty heading; a heading needs the space after its `#`.
 */
export const Tag: MarkdownConfig = {
  defineNodes: [
    { name: "Tag", style: t.labelName },
    { name: "TagMark", style: t.processingInstruction },
  ],
  parseBlock: [
    {
      name: "BareHash",
      before: "ATXHeading",
      parse(cx, line) {
        if (!/^#{1,6}$/.test(line.text.slice(line.pos))) return false;
        const from = cx.lineStart + line.pos;
        cx.addElement(cx.elt("Paragraph", from, cx.lineStart + line.text.length));
        cx.nextLine();
        return true;
      },
    },
  ],
  parseInline: [
    {
      name: "Tag",
      before: "Emphasis",
      parse(cx, next, pos) {
        if (next !== HASH) return -1;
        const prev = charBefore(cx, pos);
        if (prev !== -1 && !isSpace(prev) && prev !== OPEN_PAREN) return -1;
        let end = pos + 1;
        while (end < cx.end) {
          // By code point, so letters outside the basic plane (𠮷) count too.
          const char = String.fromCodePoint(cx.slice(end, Math.min(cx.end, end + 2)).codePointAt(0)!);
          if (!TAG_CHAR.test(char)) break;
          end += char.length;
        }
        while (end > pos + 1 && cx.char(end - 1) === SLASH) end--;
        if (end === pos + 1 || /^\d+$/.test(cx.slice(pos + 1, end))) return -1;
        return cx.addElement(cx.elt("Tag", pos, end, [cx.elt("TagMark", pos, pos + 1)]));
      },
    },
  ],
};

const AT = 64, OPEN_BRACKET = 91, BANG = 33;
/** A mention at the start of the text (see notes/properties.ts `MENTION`, which also checks what's before it). */
const MENTION_AT = /@(?:\[[^\]\n]+\]|[\p{L}\p{N}_][\p{L}\p{N}_-]*)(?:\.[\p{L}_][\p{L}\p{N}_-]*)?/uy;
const TYPE_AT = /@type\.[\p{L}\p{N}_][\p{L}\p{N}_-]*(?:\([^()\n]*\))?/iuy;
/** What can't come right before a mention's `@`: emails, `owner/repo@sha`, `\@`. */
const NOT_BEFORE_MENTION = /[\p{L}\p{N}_./\\@`]/u;
/** A wiki link at the start of the text (see notes/properties.ts `MENTION`). */
const WIKI_AT = /\[\[[^[\]\n|#]*[^\s[\]|#][^[\]\n|#]*(?:#[^[\]\n|]*)?(?:\|[^[\]\n]+)?\]\]/uy;

/**
 * A mention of another note, `@Oleks`, `@[Two Words]` or `[[Two Words]]`, or of one of its
 * properties, `@Oleks.fullname`; or of a type, `@type.recipe` (notes/properties.ts).
 */
export const Mention: MarkdownConfig = {
  defineNodes: [{ name: "Mention", style: t.link }],
  parseInline: [
    {
      name: "Mention",
      before: "Link",
      parse(cx, next, pos) {
        if (next === OPEN_BRACKET) {
          // Not an embed, `![[…]]`.
          if (cx.char(pos + 1) !== OPEN_BRACKET || charBefore(cx, pos) === BANG) return -1;
          WIKI_AT.lastIndex = 0;
          const wiki = WIKI_AT.exec(cx.slice(pos, Math.min(cx.end, pos + 300)));
          return wiki ? cx.addElement(cx.elt("Mention", pos, pos + wiki[0].length)) : -1;
        }
        if (next !== AT) return -1;
        const prev = charBefore(cx, pos);
        if (prev !== -1 && NOT_BEFORE_MENTION.test(String.fromCharCode(prev))) return -1;
        const text = cx.slice(pos, Math.min(cx.end, pos + 300));
        // A type, `@type.recipe`, can name a table's columns after it: `@type.recipe(time, servings)`.
        TYPE_AT.lastIndex = MENTION_AT.lastIndex = 0;
        const match = TYPE_AT.exec(text) ?? MENTION_AT.exec(text);
        return match ? cx.addElement(cx.elt("Mention", pos, pos + match[0].length)) : -1;
      },
    },
  ],
};

const HighlightDelim = { resolve: "Highlight", mark: "HighlightMark" };

/** `==highlighted==` text. */
export const Highlight: MarkdownConfig = {
  defineNodes: [
    { name: "Highlight", style: t.special(t.content) },
    { name: "HighlightMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "Highlight",
      after: "Emphasis",
      parse(cx, next, pos) {
        if (next !== EQUALS || cx.char(pos + 1) !== EQUALS || cx.char(pos + 2) === EQUALS) return -1;
        const before = charBefore(cx, pos);
        const after = cx.char(pos + 2);
        const spaceBefore = before === -1 || isSpace(before);
        const spaceAfter = after === -1 || isSpace(after);
        return cx.addDelimiter(HighlightDelim, pos, pos + 2, !spaceAfter, !spaceBefore);
      },
    },
  ],
};

const LESS_THAN = 60;
const UnderlineDelim = { resolve: "Underline", mark: "UnderlineMark" };

/**
 * `<u>underlined</u>` text: HTML's underline, which other Markdown apps show too. The two tags
 * pair up as a highlight's `==` do, around text that can have other styles inside.
 */
export const Underline: MarkdownConfig = {
  defineNodes: ["Underline", { name: "UnderlineMark", style: t.processingInstruction }],
  parseInline: [
    {
      name: "Underline",
      before: "HTMLTag",
      parse(cx, next, pos) {
        if (next !== LESS_THAN) return -1;
        const tag = cx.slice(pos, Math.min(cx.end, pos + 4)).toLowerCase();
        if (tag.startsWith("<u>")) return cx.addDelimiter(UnderlineDelim, pos, pos + 3, true, false);
        if (tag === "</u>") return cx.addDelimiter(UnderlineDelim, pos, pos + 4, false, true);
        return -1;
      },
    },
  ],
};

const COLON = 58;

/** A `:::` fence: three or more colons, then (on an opening fence) an optional name like `card`. */
function cardFence(line: Line): "open" | "close" | null {
  if (line.next !== COLON || line.indent - line.baseIndent >= 4) return null;
  const match = /^:{3,}(.*)$/.exec(line.text.slice(line.pos));
  if (!match) return null;
  return match[1].trim() && !match[1].includes(":") ? "open" : match[1].trim() ? null : "close";
}

/** Where each card's closing fence ended, by stack depth, so the card ends after that line. */
const closedAt = new WeakMap<BlockContext, Map<number, number>>();

/** What cards need of lezer's parse context that its types keep private: the text, and where each open block starts. */
interface ContextInternals {
  input: { read(from: number, to: number): string };
  stack: { from: number }[];
}

/** How many cards opened in `text` (whole lines) are still open at its end, going by their fences, and whether it ends in a code block. */
function openCards(text: string) {
  let open = 0;
  let code: string | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^(?:[ \t]*>)*[ \t]*/, "");
    if (code) {
      if (line.startsWith(code) && !line.slice(code.length).trim()) code = null;
      continue;
    }
    const fence = /^(`{3,}|~{3,})/.exec(line);
    if (fence) code = fence[1];
    else if (/^:{3,}\s*$/.test(line)) open = Math.max(0, open - 1);
    else if (/^:{3,}[^:]*\S[^:]*$/.test(line)) open++;
  }
  return { open, code: code !== null };
}

/**
 * What the `:::` on the current line is, going by the text of the block at `depth` (after its
 * first line, for a card): `code` in a code block, `finished` the fence of a card that's no longer
 * open in this parse (one opened inside the block and not closed yet), or `own` the block's own.
 *
 * Lezer reads the lines of a code block inside a card through the card too, so a `:::` in the
 * code would otherwise close it.
 *
 * Normally a card is open until its own closing fence, and takes it. But CodeMirror parses in
 * pieces and reuses what it parsed before, and a reused card can stop short of its closing fence
 * (when the earlier parse stopped inside it). Its fence then turns up outside it. Without this, an
 * outer card would close on it, and the outer card's own fence would open a new card that runs on
 * to the end of the note.
 */
function fenceKind(cx: BlockContext, depth: number, skipFirstLine: boolean): "code" | "finished" | "own" {
  const { input, stack } = cx as unknown as ContextInternals;
  const from = stack?.[depth]?.from;
  if (from === undefined || !input) return "own";
  const text = input.read(from, cx.lineStart);
  const { open, code } = openCards(skipFirstLine ? text.slice(text.indexOf("\n") + 1) : text);
  return code ? "code" : open > 0 ? "finished" : "own";
}

/**
 * Cards: Markdown between `::: card` and `:::` (Pandoc's fenced divs), drawn as a card.
 * Anything can go inside, other cards too; a bare `:::` closes the innermost one.
 */
export const Card: MarkdownConfig = {
  defineNodes: [
    {
      name: "Card",
      block: true,
      composite(cx, line) {
        // Which open block this call is for. Lezer has it on the line, though not in its types.
        const depth = (line as Line & { depth: number }).depth;
        const closedCards = closedAt.get(cx);
        const closed = closedCards?.get(depth);
        if (closed !== undefined && closed === cx.prevLineEnd()) return false;
        // A card inside this one takes the fence, unless it closed on the line before: it's still
        // open until this line, but a `:::` right after its own closes this one.
        for (let d = depth + 1; d < cx.depth; d++) {
          if (cx.parentType(d).name === "Card" && closedCards?.get(d) !== cx.prevLineEnd()) return true;
        }
        if (cardFence(line) !== "close") return true;
        const kind = fenceKind(cx, depth, true);
        if (kind === "code") return true;
        const end = cx.lineStart + line.text.length;
        line.addMarker(cx.elt("CardMark", cx.lineStart + line.pos, end));
        line.moveBase(line.text.length);
        // The fence of a card inside this one, which the parse has already finished: this one stays open.
        if (kind === "finished") return true;
        if (!closedAt.has(cx)) closedAt.set(cx, new Map());
        closedAt.get(cx)!.set(depth, end);
        return true;
      },
    },
    { name: "CardMark", style: t.processingInstruction },
  ],
  parseBlock: [
    {
      name: "Card",
      before: "FencedCode",
      parse(cx, line) {
        // Inside a card a bare `:::` closes it (above); elsewhere it opens one.
        const fence = cardFence(line);
        if (!fence) return false;
        // Unless it's the fence of a card the parse has already finished (see fenceKind).
        if (fence === "close" && fenceKind(cx, cx.depth - 1, cx.parentType().name === "Card") === "finished") {
          cx.addElement(cx.elt("CardMark", cx.lineStart + line.pos, cx.lineStart + line.text.length));
          cx.nextLine();
          return true;
        }
        cx.startComposite("Card", line.pos);
        cx.addElement(cx.elt("CardMark", cx.lineStart + line.pos, cx.lineStart + line.text.length));
        line.moveBase(line.text.length);
        return null;
      },
      endLeaf: (_cx, line) => cardFence(line) !== null,
    },
  ],
};

const DOLLAR = 36, BACKSLASH = 92;

const isDigit = (code: number) => code >= 48 && code <= 57;

/** A `$$` line, which opens and closes a block of math. */
const isMathFence = (line: Line) => line.next === DOLLAR && line.indent - line.baseIndent < 4 && line.text.slice(line.pos).trim() === "$$";

/**
 * Where inline math can close in a paragraph's text: each `$` that isn't escaped (an odd number of
 * backslashes before it), and isn't after a space or before a digit; and each unescaped `$$`. That
 * doesn't depend on where the math opened, so it's found once rather than read again from each `$`
 * to the paragraph's end, which a paragraph of prices made slow.
 */
const closers = new WeakMap<InlineContext, { single: number[]; double: number[] }>();

function closersIn(cx: InlineContext) {
  let found = closers.get(cx);
  if (!found) {
    found = { single: [], double: [] };
    for (let i = cx.offset; i < cx.end; i++) {
      const char = cx.char(i);
      if (char === BACKSLASH) i++;
      else if (char === DOLLAR) {
        if (cx.char(i + 1) === DOLLAR) found.double.push(i);
        if (!isSpace(cx.char(i - 1)) && !isDigit(cx.char(i + 1))) found.single.push(i);
      }
    }
    closers.set(cx, found);
  }
  return found;
}

/** The first of `positions` (in order) at or after `pos`, or -1. */
function firstFrom(positions: number[], pos: number) {
  let [low, high] = [0, positions.length];
  while (low < high) {
    const mid = (low + high) >> 1;
    if (positions[mid] < pos) low = mid + 1;
    else high = mid;
  }
  return low < positions.length ? positions[low] : -1;
}

/**
 * LaTeX math, as in Pandoc and GitHub: `$x^2$` within text, `$$\sum x$$` displayed, and a block
 * between `$$` lines. Nothing inside is read as Markdown, so `$a_1 * b_2$` stays math.
 */
export const TexMath: MarkdownConfig = {
  defineNodes: [
    { name: "InlineMath", style: t.monospace },
    { name: "MathBlock", block: true, style: t.monospace },
    { name: "MathMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "InlineMath",
      before: "Emphasis",
      parse(cx, next, pos) {
        if (next !== DOLLAR) return -1;
        const size = cx.char(pos + 1) === DOLLAR ? 2 : 1;
        // Like Pandoc: no space just inside a single `$`, and no digit right after the closing one,
        // so prices ("$5 and $10") stay text.
        const first = cx.char(pos + size);
        if (first === -1 || first === DOLLAR || (size === 1 && isSpace(first))) return -1;
        const { single, double } = closersIn(cx);
        const close = firstFrom(size === 1 ? single : double, pos + size);
        if (close < 0) return -1;
        const end = close + size;
        return cx.addElement(cx.elt("InlineMath", pos, end, [cx.elt("MathMark", pos, pos + size), cx.elt("MathMark", close, end)]));
      },
    },
  ],
  parseBlock: [
    {
      name: "MathBlock",
      before: "FencedCode",
      parse(cx, line) {
        if (!isMathFence(line)) return false;
        const from = cx.lineStart + line.pos;
        const marks = [cx.elt("MathMark", from, from + 2)];
        // Lezer has the line's depth, though not in its types: lines past the block's quote or list item end it.
        while (cx.nextLine() && (line as Line & { depth: number }).depth >= cx.depth) {
          marks.push(...line.markers);
          if (isMathFence(line)) {
            const at = cx.lineStart + line.pos;
            marks.push(cx.elt("MathMark", at, at + 2));
            cx.nextLine();
            break;
          }
        }
        cx.addElement(cx.elt("MathBlock", from, cx.prevLineEnd(), marks));
        return true;
      },
      endLeaf: (_cx, line) => isMathFence(line),
    },
  ],
};
