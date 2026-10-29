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

/** Bear-style `#tag` and `#nested/tag`. */
export const Tag: MarkdownConfig = {
  defineNodes: [
    { name: "Tag", style: t.labelName },
    { name: "TagMark", style: t.processingInstruction },
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
