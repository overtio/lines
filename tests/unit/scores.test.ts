import { expect, test } from "bun:test";
import { stubApp } from "./stubs";

stubApp();
const { scoreIn } = await import("../../src/lib/editor/scores");

test("a score is a whole number out of 2 to 10, spaces or not, and anything else isn't one", () => {
  expect(scoreIn("5/7")).toEqual({ score: 5, of: 7 });
  expect(scoreIn(" 4 / 5 ")).toEqual({ score: 4, of: 5 });
  expect(scoreIn("0/10")).toEqual({ score: 0, of: 10 });
  for (const value of ["8/7", "3/12", "1/1", "4.5/5", "5/7 stars", "1/2/3", "2026/11"]) expect(scoreIn(value)).toBeNull();
});
