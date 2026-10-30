/*
 * Symbols: `->` shown as →, `!=` as ≠ and the like, only where a note is drawn (the editor, its
 * tables, its PDF and pictures). The note keeps what was typed, so it copies, syncs and opens
 * elsewhere as typed. Settings → Text turns them off in text and in code separately.
 */

export const SYMBOLS: Record<string, string> = {
  "<->": "↔",
  "<=>": "⇔",
  "->": "→",
  "<-": "←",
  "=>": "⇒",
  "<=": "≤",
  ">=": "≥",
  "!=": "≠",
};

/**
 * One of them, but not inside a longer run of the same characters (`-->`, `<!--`, `!==`, `>>=`,
 * which mean something else), nor after a backslash: `\->` stays as typed.
 */
const PATTERN = /(?<![<>=!\-\\])(?:<->|<=>|->|<-|=>|<=|>=|!=)(?![<>=\-])/g;

/** Each one in `text`: where it is, and the symbol it's shown as. */
export function findSymbols(text: string): { from: number; to: number; symbol: string }[] {
  return [...text.matchAll(PATTERN)].map((match) => ({
    from: match.index,
    to: match.index + match[0].length,
    symbol: SYMBOLS[match[0]],
  }));
}

/** `text` as it's shown, with its symbols. */
export const withSymbols = (text: string) => text.replace(PATTERN, (found) => SYMBOLS[found]);

/**
 * Pieces of `source` as they're shown, for code cut into highlighted tokens: `shown(from, to)`
 * is that piece with its symbols, one that starts in an earlier piece left in that one.
 */
export function symbolPieces(source: string) {
  const found = findSymbols(source);
  return (from: number, to: number) => {
    let shown = "";
    let pos = from;
    for (const symbol of found) {
      if (symbol.to <= from || symbol.from >= to) continue;
      if (symbol.from >= from) shown += source.slice(pos, symbol.from) + symbol.symbol;
      pos = Math.min(symbol.to, to);
    }
    return shown + source.slice(pos, to);
  };
}
