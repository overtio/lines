import { describe, expect, test } from "bun:test";
import { stubApp } from "./stubs";

stubApp();
const { mergeLooks, readLooks, writeLooks } = await import("../../src/lib/notes/looks");
const { noRatings, readScale } = await import("../../src/lib/library/ratings");
const { renameKey } = await import("../../src/lib/notes/properties");
const { looks, tagLooks } = await import("../../src/lib/notes/looks.svelte");
const { tagColorCss } = await import("../../src/lib/editor/tagColors");

describe("tags' and types' looks", () => {
  test("merge choice by choice: the later wins, and at the same time the other device's, so both end up alike", () => {
    const here = { tags: { work: { color: "blue" as const, at: 20 }, home: { icon: "house" as const, at: 0 } }, types: { person: { icon: "user" as const, at: 5 } }, ratings: noRatings() };
    const there = { tags: { work: { color: "red" as const, at: 10 }, home: { icon: "bed" as const, at: 0 } }, types: { book: { color: "green" as const, at: 7 } }, ratings: noRatings() };
    expect(mergeLooks(here, there)).toEqual({
      tags: { work: { color: "blue", at: 20 }, home: { icon: "bed", at: 0 } },
      types: { person: { icon: "user", at: 5 }, book: { color: "green", at: 7 } },
      ratings: noRatings(),
    });
  });

  test("one set back to how it was stays, empty, so that syncs too", () => {
    const here = { tags: { work: { at: 30 } }, types: {}, ratings: noRatings() };
    const there = { tags: { work: { color: "red" as const, at: 10 } }, types: {}, ratings: noRatings() };
    expect(mergeLooks(here, there).tags.work).toEqual({ at: 30 });
  });

  test("read back as written; an icon or color this lines doesn't have, or a file it can't read, is left out", () => {
    const looks = { tags: { b: { icon: "house" as const, at: 2 }, a: { color: "purple" as const, at: 1 } }, types: {}, ratings: noRatings() };
    expect(readLooks(writeLooks(looks))).toEqual(looks);
    expect(Object.keys(JSON.parse(writeLooks(looks)).tags)).toEqual(["a", "b"]);
    expect(readLooks('{"tags":{"x":{"icon":"no-such-icon","color":"teal","at":"soon"}}}')).toEqual({ tags: { x: { at: 0 } }, types: {}, ratings: noRatings() });
    expect(readLooks("not json")).toEqual({ tags: {}, types: {}, ratings: noRatings() });
  });

  test("a renamed tag keeps its look, as do those nested in it, unless the new name has its own; the old names go back, which syncs", () => {
    tagLooks.setColor("work", "green");
    tagLooks.setIcon("work/meetings", "users");
    tagLooks.setIcon("job", "briefcase");
    tagLooks.setColor("job", "red");
    tagLooks.rename("work", "job");
    expect([tagLooks.icon("job"), tagLooks.color("job")]).toEqual(["briefcase", "red"]);
    expect(tagLooks.icon("job/meetings")).toBe("users");
    expect([tagLooks.icon("work"), tagLooks.color("work"), tagLooks.icon("work/meetings")]).toEqual(["hash", undefined, "hash"]);
    expect(looks.looks.tags.work.at).toBeGreaterThan(0);
  });

  test("a nested tag has the color of the nearest tag it's in that has one, until it's given its own", () => {
    tagLooks.setColor("home", "blue");
    expect(tagLooks.color("home/garden/roses")).toBeUndefined();
    expect(tagLooks.shownColor("home/garden/roses")).toBe("blue");
    expect(tagLooks.inherited("home/garden/roses")).toEqual({ color: "blue", from: "home" });
    tagLooks.setColor("home/garden", "green");
    expect(tagLooks.inherited("home/garden/roses")).toEqual({ color: "green", from: "home/garden" });
    tagLooks.setColor("home/garden/roses", "red");
    expect(tagLooks.shownColor("home/garden/roses")).toBe("red");
    tagLooks.setColor("home/garden/roses", null);
    expect(tagLooks.shownColor("home/garden/roses")).toBe("green");
    expect(tagLooks.inherited("home")).toBeUndefined();
  });

  test("tags in notes take their colors from a stylesheet, nested tags their tag's, a deeper one's own coming after to win", () => {
    const css = tagColorCss({ tags: { "work/meetings": { color: "red", at: 1 }, work: { color: "blue", at: 1 }, home: { icon: "house", at: 1 } }, types: {}, ratings: noRatings() });
    const rules = css.split("\n");
    expect(rules.at(-2)).toBe('.cm-lp-tag:is([data-tag="work"],[data-tag^="work/"]){--tag-look:var(--palette-blue)}');
    expect(rules.at(-1)).toBe('.cm-lp-tag:is([data-tag="work/meetings"],[data-tag^="work/meetings/"]){--tag-look:var(--palette-red)}');
    expect(css).not.toContain("home");
    expect(tagColorCss({ tags: {}, types: {}, ratings: noRatings() })).toBe("");
  });
});

describe("what the Library's kinds are rated on, in the same file", () => {
  const scales = {
    vibes: { name: "Vibes", scale: { kind: "labels" as const, labels: ["Masterpiece", "Great", "Meh"] }, at: 5 },
    hearts: { name: "Hearts", scale: { kind: "marks" as const, of: 7, icon: "heart" as const }, at: 6 },
  };

  test("each kind's scale, its named ratings and each scale of your own merge as choices of their own, the later winning", () => {
    const here = {
      kinds: { show: { scale: { id: "10", at: 30 }, named: { names: ["Story"], at: 10 } }, book: { scale: { id: "grades", at: 2 } } },
      scales: { vibes: scales.vibes },
    };
    const there = {
      kinds: { show: { scale: { id: "5", at: 20 }, named: { names: ["Story", "Music"], at: 25 } }, movie: { named: { names: ["Score"], at: 1 } } },
      scales: { vibes: { removed: true as const, at: 9 }, hearts: scales.hearts },
    };
    const merged = mergeLooks({ tags: {}, types: {}, ratings: here }, { tags: {}, types: {}, ratings: there }).ratings;
    expect(merged.kinds).toEqual({
      show: { scale: { id: "10", at: 30 }, named: { names: ["Story", "Music"], at: 25 } },
      book: { scale: { id: "grades", at: 2 } },
      movie: { named: { names: ["Score"], at: 1 } },
    });
    // A scale removed on another device since stays removed, which syncs too.
    expect(merged.scales).toEqual({ vibes: { removed: true, at: 9 }, hearts: scales.hearts });
  });

  test("read back as written; what this lines can't draw, or a named rating that can't be a property's key, is left out", () => {
    const ratings = { kinds: { show: { scale: { id: "vibes", at: 3 }, named: { names: ["Story", "Voice acting"], at: 4 } } }, scales };
    const looks = { tags: {}, types: {}, ratings };
    expect(readLooks(writeLooks(looks))).toEqual(looks);
    const file = JSON.parse(writeLooks(looks));
    expect(Object.keys(file.ratings.scales)).toEqual(["hearts", "vibes"]);
    const odd = JSON.stringify({
      ratings: {
        kinds: { show: { named: { names: ["Story: part 1"], at: 1 } }, movie: { named: { names: ["Score", "score"], at: 1 } } },
        scales: { a: { name: "Lots", scale: { kind: "marks", of: 50 } }, b: { name: "One", scale: { kind: "labels", labels: ["Only"] } }, c: { scale: { kind: "points", of: 10 } } },
      },
    });
    expect(readLooks(odd).ratings).toEqual(noRatings());
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

test("a named rating renamed is renamed in a note's properties, where it is and as it's set, unless the note has the new one too", () => {
  const note = "---\ntype: show\nStory : 8/10\nmusic: A\n---\n# Frieren\n\nstory: kept as it is";
  expect(renameKey(note, "story", "plot")).toBe("---\ntype: show\nplot: 8/10\nmusic: A\n---\n# Frieren\n\nstory: kept as it is");
  expect(renameKey(note, "story", "music")).toBe(note);
  expect(renameKey(note, "acting", "cast")).toBe(note);
});
