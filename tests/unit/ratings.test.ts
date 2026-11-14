import { describe, expect, test } from "bun:test";
import { stubApp } from "./stubs";

stubApp();
const { mergeRatings, noRatings, readRatings, readScale, writeRatings } = await import("../../src/lib/library/ratings");
const { renameKey } = await import("../../src/lib/notes/properties");

/*
 * What the Library's kinds are rated on (lib/library/ratings.ts): `ratings.json`, a file of its own,
 * read, written and merged choice by choice; and a named rating renamed in a note.
 */

const scales = {
  vibes: { name: "Vibes", scale: { kind: "labels" as const, labels: ["Masterpiece", "Great", "Meh"] }, at: 5 },
  hearts: { name: "Hearts", scale: { kind: "marks" as const, of: 7, icon: "heart" as const }, at: 6 },
};

describe("what kinds are rated on, as ratings.json", () => {
  test("each kind's scale, its named ratings and each scale of your own merge as choices of their own, the later winning", () => {
    const here = {
      kinds: { show: { scale: { id: "10", at: 30 }, named: { names: ["Story"], at: 10 } }, book: { scale: { id: "grades", at: 2 } } },
      scales: { vibes: scales.vibes },
    };
    const there = {
      kinds: { show: { scale: { id: "5", at: 20 }, named: { names: ["Story", "Music"], at: 25 } }, movie: { named: { names: ["Score"], at: 1 } } },
      scales: { vibes: { removed: true as const, at: 9 }, hearts: scales.hearts },
    };
    const merged = mergeRatings(here, there);
    expect(merged.kinds).toEqual({
      show: { scale: { id: "10", at: 30 }, named: { names: ["Story", "Music"], at: 25 } },
      book: { scale: { id: "grades", at: 2 } },
      movie: { named: { names: ["Score"], at: 1 } },
    });
    // Removed on another device since, and nothing's rated on it: removed, which syncs too.
    expect(merged.scales).toEqual({ vibes: { removed: true, at: 9 }, hearts: scales.hearts });
  });

  test("a scale a kind is rated on stays, though another device removed it, until nothing's rated on it", () => {
    const chosen = { kinds: { movie: { scale: { id: "vibes", at: 3 } } }, scales: { vibes: scales.vibes } };
    const removed = { kinds: {}, scales: { vibes: { removed: true as const, at: 50 } } };
    for (const merged of [mergeRatings(chosen, removed), mergeRatings(removed, chosen)]) {
      expect(merged.scales.vibes).toEqual(scales.vibes);
      expect(merged.kinds.movie.scale?.id).toBe("vibes");
    }
    // Once the movie's on another scale, the removal holds.
    const moved = { kinds: { movie: { scale: { id: "5", at: 60 } } }, scales: removed.scales };
    expect(mergeRatings(chosen, moved).scales.vibes).toEqual({ removed: true, at: 50 });
  });

  test("read back as written, in order; what this lines can't draw, or named ratings that are one property, left out", () => {
    const ratings = { kinds: { show: { scale: { id: "vibes", at: 3 }, named: { names: ["Story", "Voice acting"], at: 4 } } }, scales };
    expect(readRatings(writeRatings(ratings))).toEqual(ratings);
    const file = JSON.parse(writeRatings(ratings));
    expect(file.format).toBe("lines-ratings");
    expect(Object.keys(file.scales)).toEqual(["hearts", "vibes"]);
    const odd = JSON.stringify({
      kinds: { show: { named: { names: ["Story: part 1"], at: 1 } }, movie: { named: { names: ["Voice acting", "voice-acting"], at: 1 } } },
      scales: { a: { name: "Lots", scale: { kind: "marks", of: 50 } }, b: { name: "One", scale: { kind: "labels", labels: ["Only"] } }, c: { scale: { kind: "points", of: 10 } } },
    });
    expect(readRatings(odd)).toEqual(noRatings());
    expect(readRatings("not json")).toEqual(noRatings());
  });

  test("a scale of your own: marks out of 2 to 10 in an icon lines has, points out of up to 1,000, or 2 to 20 words, each once", () => {
    expect(readScale({ kind: "marks", of: 7, icon: "heart" })).toEqual({ kind: "marks", of: 7, icon: "heart" });
    expect(readScale({ kind: "marks", of: 7, icon: "no-such-icon" })).toEqual({ kind: "marks", of: 7 });
    expect(readScale({ kind: "marks", of: 11 })).toBeNull();
    expect(readScale({ kind: "points", of: 1000 })).toEqual({ kind: "points", of: 1000 });
    expect(readScale({ kind: "points", of: 2.5 })).toBeNull();
    expect(readScale({ kind: "labels", labels: [" Great ", "Fine"] })).toEqual({ kind: "labels", labels: ["Great", "Fine"] });
    expect(readScale({ kind: "labels", labels: ["Great", "great"] })).toBeNull();
    expect(readScale({ kind: "labels", labels: ["Good, really", "Bad"] })).toBeNull();
  });
});

test("a named rating renamed in a note: where it is and as it's set, only where its value is a rating, and not over one the note has", () => {
  const note = "---\ntype: show\nStory : 8/10\nmusic: A\n---\n# Frieren\n\nstory: kept as it is";
  const rating = (value: string) => /^\d+\/10$/.test(value);
  expect(renameKey(note, "story", "plot", rating)).toBe("---\ntype: show\nplot: 8/10\nmusic: A\n---\n# Frieren\n\nstory: kept as it is");
  expect(renameKey("---\ntype: show\nstory: a long one\n---", "story", "plot", rating)).toBe("---\ntype: show\nstory: a long one\n---");
  expect(renameKey(note, "story", "music")).toBe(note);
  expect(renameKey(note, "acting", "cast")).toBe(note);
});
