/** Where two lists of lines differ: lines `before[0]` up to `before[1]` became `after[0]` up to `after[1]`. */
export interface Hunk {
  before: [number, number];
  after: [number, number];
}

/**
 * Where `a` became `b`, in as few lines added and taken out as can be (Myers' diff), after what's the
 * same at both ends is set aside: most edits are in one place. Past `limit` changes it stops looking,
 * and calls everything between one change.
 */
export function diffLines(a: string[], b: string[], limit = 500): Hunk[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const n = endA - start;
  const m = endB - start;
  if (!n && !m) return [];
  const whole: Hunk[] = [{ before: [start, endA], after: [start, endB] }];
  if (!n || !m) return whole;

  // The furthest each diagonal k (x − y) reaches after d changes, kept for each d (just the
  // diagonals it can reach) to trace the way back.
  const same = (x: number, y: number) => a[start + x] === b[start + y];
  const reach = new Map<number, number>([[1, 0]]);
  const trace: Map<number, number>[] = [];
  let steps = -1;
  search: for (let d = 0; d <= Math.min(n + m, limit); d++) {
    trace.push(new Map(reach));
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (reach.get(k - 1) ?? -1) < (reach.get(k + 1) ?? -1));
      let x = down ? (reach.get(k + 1) ?? 0) : (reach.get(k - 1) ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && same(x, y)) {
        x++;
        y++;
      }
      reach.set(k, x);
      if (x >= n && y >= m) {
        steps = d;
        break search;
      }
    }
  }
  if (steps < 0) return whole;

  // Back from the end: each line the same, added (to b) or taken out (of a), in reverse.
  const edits: ("same" | "added" | "removed")[] = [];
  let x = n;
  let y = m;
  for (let d = steps; d > 0; d--) {
    const previous = trace[d];
    const k = x - y;
    const down = k === -d || (k !== d && (previous.get(k - 1) ?? -1) < (previous.get(k + 1) ?? -1));
    const fromK = down ? k + 1 : k - 1;
    const fromX = previous.get(fromK) ?? 0;
    const fromY = fromX - fromK;
    while (x > fromX && y > fromY) {
      edits.push("same");
      x--;
      y--;
    }
    edits.push(down ? "added" : "removed");
    x = fromX;
    y = fromY;
  }
  while (x > 0 && y > 0) {
    edits.push("same");
    x--;
    y--;
  }

  // Runs of changes, forward.
  const hunks: Hunk[] = [];
  let i = start;
  let j = start;
  for (const edit of edits.reverse()) {
    if (edit === "same") {
      i++;
      j++;
      continue;
    }
    const last = hunks.at(-1);
    if (!last || last.before[1] !== i || last.after[1] !== j) hunks.push({ before: [i, i], after: [j, j] });
    const hunk = hunks.at(-1)!;
    if (edit === "added") hunk.after[1] = ++j;
    else hunk.before[1] = ++i;
  }
  return hunks;
}
