import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { bestSpeed, Drill, keepBest, matches, passageOf } from "../../src/plugins/typing/drill.svelte";

let clock = 0;
beforeEach(() => {
  clock = 1000;
  spyOn(performance, "now").mockImplementation(() => clock);
  localStorage.clear();
});
afterEach(() => {
  (performance.now as unknown as { mockRestore(): void }).mockRestore();
});

/** Types `text` a character at a time, `ms` apart, as a text field would hold it. */
function typeOut(drill: Drill, text: string, ms = 200) {
  let value = drill.typed.join("");
  for (const char of text) {
    clock += ms;
    value = drill.type(value + char);
  }
  return value;
}

describe("passageOf", () => {
  test("keeps line breaks, one for a blank line between paragraphs", () => {
    expect(passageOf("One.\n\n\nTwo.\nThree.")).toBe("One.\nTwo.\nThree.");
  });
  test("drops spaces at the ends of lines, and blank lines at the ends", () => {
    expect(passageOf("\n\n  a  \nb\t\n\n")).toBe("a\nb");
  });
  test("makes tabs two spaces", () => {
    expect(passageOf("if x:\n\tgo()")).toBe("if x:\n  go()");
  });
});

describe("matches", () => {
  test("takes plain keys for curly quotes, dashes and a no-break space", () => {
    for (const [wanted, typed] of [["’", "'"], ["‘", "'"], ["“", '"'], ["”", '"'], ["–", "-"], ["—", "-"], ["\u00a0", " "]]) expect(matches(wanted, typed)).toBe(true);
  });
  test("but not other characters", () => {
    expect(matches("a", "b")).toBe(false);
    expect(matches("é", "e")).toBe(false);
    expect(matches("'", "’")).toBe(false);
  });
});

describe("Drill", () => {
  test("starts with the first key and finishes with the last", () => {
    const drill = new Drill("abc");
    expect(drill.started).toBeNull();
    typeOut(drill, "ab");
    expect(drill.going).toBe(true);
    typeOut(drill, "c");
    expect(drill.finished).not.toBeNull();
    expect(drill.going).toBe(false);
  });

  test("counts mistakes, even fixed ones, and the keys missed", () => {
    const drill = new Drill("the cat");
    typeOut(drill, "thx");
    drill.type("th");
    typeOut(drill, "e cqt");
    expect(drill.mistakes).toBe(2);
    expect(drill.keys).toBe(8);
    expect(drill.accuracy).toBe(75);
    expect(drill.missed()).toEqual(["e", "a"]);
    expect(drill.right(5)).toBe(false);
    expect(drill.right(4)).toBe(true);
  });

  test("works out words a minute from what's typed right", () => {
    const drill = new Drill("aaaaa bbbbb");
    // 11 characters, 200 ms apart: the first starts the clock, so 2 s for 11 right.
    typeOut(drill, "aaaaa bbbbb");
    expect(drill.time).toBe(2000);
    expect(drill.speed).toBe(Math.round(11 / 5 / (2 / 60)));
  });

  test("shows no speed before a second has passed", () => {
    const drill = new Drill("abcdef");
    typeOut(drill, "abc", 100);
    expect(drill.speed).toBe(0);
  });

  test("doesn't count time away", () => {
    const drill = new Drill("abcd");
    typeOut(drill, "ab");
    drill.away(true);
    clock += 60_000;
    drill.away(false);
    typeOut(drill, "cd");
    expect(drill.time).toBe(600);
  });

  test("types the next line's indent after a line break", () => {
    const drill = new Drill("if x:\n    go()");
    expect(typeOut(drill, "if x:\n")).toBe("if x:\n    ");
    expect(drill.keys).toBe(6);
    typeOut(drill, "go()");
    expect(drill.finished).not.toBeNull();
    expect(drill.mistakes).toBe(0);
  });

  test("takes an emoji or an accented letter as one character", () => {
    const drill = new Drill("café 🙂!");
    expect(drill.wanted).toHaveLength(7);
    typeOut(drill, "café 🙂!");
    expect(drill.mistakes).toBe(0);
    expect(drill.finished).not.toBeNull();
  });

  test("ignores more than the passage, and anything once it's done", () => {
    const drill = new Drill("ab");
    expect(drill.type("abcdef")).toBe("ab");
    expect(drill.keys).toBe(2);
    expect(drill.type("a")).toBe("ab");
  });

  test("an empty passage never finishes", () => {
    const drill = new Drill("");
    expect(drill.type("x")).toBe("");
    expect(drill.finished).toBeNull();
  });

  test("starts again", () => {
    const drill = new Drill("ab");
    typeOut(drill, "ax");
    drill.reset();
    expect([drill.typed, drill.keys, drill.mistakes, drill.started, drill.finished, drill.missed()]).toEqual([[], 0, 0, null, null, []]);
    expect(drill.passage).toBe("ab");
  });
});

describe("best speeds", () => {
  test("are kept for each passage, only when beaten", () => {
    expect(bestSpeed("one")).toBeUndefined();
    expect(keepBest("one", 40)).toBe(true);
    expect(keepBest("one", 30)).toBe(false);
    expect(keepBest("two", 20)).toBe(true);
    expect(bestSpeed("one")).toBe(40);
    expect(bestSpeed("two")).toBe(20);
  });
  test("survive storage that isn't JSON", () => {
    localStorage.setItem("lines.typing.best", "{oops");
    expect(bestSpeed("one")).toBeUndefined();
    expect(keepBest("one", 10)).toBe(true);
  });
});
