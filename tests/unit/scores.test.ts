import { describe, expect, test } from "bun:test";
import { stubApp } from "./stubs";

stubApp();
const { fractionOf, scoreIn, scoreOn, scoresOf, scoreText } = await import("../../src/lib/editor/scores");
type Scale = import("../../src/lib/editor/scores").Scale;

describe("scores", () => {
  test("with no scale, marks out of 2 to 10, whole or by halves, spaces or not, and anything else isn't one", () => {
    expect(scoreIn("5/7")).toEqual({ score: 5, of: 7 });
    expect(scoreIn(" 4 / 5 ")).toEqual({ score: 4, of: 5 });
    expect(scoreIn("0/10")).toEqual({ score: 0, of: 10 });
    expect(scoreIn("4.5/5")).toEqual({ score: 4.5, of: 5 });
    for (const value of ["8/7", "3/12", "1/1", "4.3/5", "85/100", "5/7 stars", "1/2/3", "2026/11", "A"]) expect(scoreIn(value)).toBeNull();
  });

  test("marks of a scale: out of its number, halves too, and nothing out of another", () => {
    const stars: Scale = { kind: "marks", of: 5 };
    expect(scoreIn("3.5/5", stars)).toEqual({ score: 3.5, of: 5 });
    expect(scoreIn("7/10", stars)).toBeNull();
    expect(scoreIn("A", stars)).toBeNull();
    const seven: Scale = { kind: "marks", of: 7, icon: "heart" };
    expect(scoreIn("6/7", seven)).toEqual({ score: 6, of: 7 });
  });

  test("points: out of its number, to a tenth, up to 100 and more", () => {
    const hundred: Scale = { kind: "points", of: 100 };
    expect(scoreIn("85/100", hundred)).toEqual({ score: 85, of: 100 });
    expect(scoreIn("100 / 100", hundred)).toEqual({ score: 100, of: 100 });
    expect(scoreIn("85/10", hundred)).toBeNull();
    expect(scoreIn("101/100", hundred)).toBeNull();
    const ten: Scale = { kind: "points", of: 10 };
    expect(scoreIn("7.5/10", ten)).toEqual({ score: 7.5, of: 10 });
    expect(scoreIn("7.25/10", ten)).toBeNull();
    expect(scoreIn("4/5", ten)).toBeNull();
  });

  test("words: any of a scale's, without case, counted up from the worst, and written as the scale writes them", () => {
    const grades: Scale = { kind: "labels", labels: ["S", "A", "B", "C", "D", "F"] };
    expect(scoreIn("a", grades)).toEqual({ score: 5, of: 6, label: "A" });
    expect(scoreIn("S", grades)).toEqual({ score: 6, of: 6, label: "S" });
    expect(scoreIn("F", grades)).toEqual({ score: 1, of: 6, label: "F" });
    expect(scoreIn("E", grades)).toBeNull();
    expect(scoreIn("4/5", grades)).toBeNull();
    const own: Scale = { kind: "labels", labels: ["Masterpiece", "Great", "Fine", "Meh"] };
    expect(scoreIn(" masterpiece ", own)).toEqual({ score: 4, of: 4, label: "Masterpiece" });
    const thumbs: Scale = { kind: "labels", labels: ["thumbs up", "thumbs down"], icons: ["thumbs-up", "thumbs-down"] };
    expect(scoreIn("Thumbs Down", thumbs)).toEqual({ score: 1, of: 2, label: "thumbs down" });
  });

  test("written back as each scale writes them, and offered the best first", () => {
    const grades: Scale = { kind: "labels", labels: ["S", "A", "B"] };
    expect(scoreText(4, { kind: "marks", of: 5 })).toBe("4/5");
    expect(scoreText(3.5, { kind: "marks", of: 5 })).toBe("3.5/5");
    expect(scoreText(85, { kind: "points", of: 100 })).toBe("85/100");
    expect(scoreText(2, grades)).toBe("A");
    expect(scoreOn(2, grades)).toEqual({ score: 2, of: 3, label: "A" });
    expect(scoresOf({ kind: "marks", of: 5 })).toEqual([5, 4, 3, 2, 1]);
    expect(scoresOf({ kind: "points", of: 100 })).toEqual([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
    expect(scoresOf({ kind: "points", of: 20 })).toEqual([20, 18, 16, 14, 12, 10, 8, 6, 4, 2]);
    expect(scoresOf(grades)).toEqual([3, 2, 1]);
  });

  test("how high a score is, from 0 to 1, whatever its scale, to sort by", () => {
    expect(fractionOf({ score: 4, of: 5 })).toBe(0.8);
    expect(fractionOf({ score: 85, of: 100 })).toBe(0.85);
    expect(fractionOf({ score: 6, of: 6, label: "S" })).toBe(1);
    expect(fractionOf({ score: 1, of: 6, label: "F" })).toBe(0);
  });
});
