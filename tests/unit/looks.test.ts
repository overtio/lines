import { describe, expect, test } from "bun:test";
import { stubApp } from "./stubs";

stubApp();
const { mergeLooks, readLooks, writeLooks } = await import("../../src/lib/notes/looks");
const { looks, tagLooks } = await import("../../src/lib/notes/looks.svelte");
const { tagColorCss } = await import("../../src/lib/editor/tagColors");

describe("tags' and types' looks", () => {
  test("merge choice by choice: the later wins, and at the same time the other device's, so both end up alike", () => {
    const here = { tags: { work: { color: "blue" as const, at: 20 }, home: { icon: "house" as const, at: 0 } }, types: { person: { icon: "user" as const, at: 5 } } };
    const there = { tags: { work: { color: "red" as const, at: 10 }, home: { icon: "bed" as const, at: 0 } }, types: { book: { color: "green" as const, at: 7 } } };
    expect(mergeLooks(here, there)).toEqual({
      tags: { work: { color: "blue", at: 20 }, home: { icon: "bed", at: 0 } },
      types: { person: { icon: "user", at: 5 }, book: { color: "green", at: 7 } },
    });
  });

  test("one set back to how it was stays, empty, so that syncs too", () => {
    const here = { tags: { work: { at: 30 } }, types: {} };
    const there = { tags: { work: { color: "red" as const, at: 10 } }, types: {} };
    expect(mergeLooks(here, there).tags.work).toEqual({ at: 30 });
  });

  test("read back as written; an icon or color this lines doesn't have, or a file it can't read, is left out", () => {
    const looks = { tags: { b: { icon: "house" as const, at: 2 }, a: { color: "purple" as const, at: 1 } }, types: {} };
    expect(readLooks(writeLooks(looks))).toEqual(looks);
    expect(Object.keys(JSON.parse(writeLooks(looks)).tags)).toEqual(["a", "b"]);
    expect(readLooks('{"tags":{"x":{"icon":"no-such-icon","color":"teal","at":"soon"}}}')).toEqual({ tags: { x: { at: 0 } }, types: {} });
    expect(readLooks("not json")).toEqual({ tags: {}, types: {} });
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
    const css = tagColorCss({ tags: { "work/meetings": { color: "red", at: 1 }, work: { color: "blue", at: 1 }, home: { icon: "house", at: 1 } }, types: {} });
    const rules = css.split("\n");
    expect(rules.at(-2)).toBe('.cm-lp-tag:is([data-tag="work"],[data-tag^="work/"]){--tag-look:var(--palette-blue)}');
    expect(rules.at(-1)).toBe('.cm-lp-tag:is([data-tag="work/meetings"],[data-tag^="work/meetings/"]){--tag-look:var(--palette-red)}');
    expect(css).not.toContain("home");
    expect(tagColorCss({ tags: {}, types: {} })).toBe("");
  });
});
