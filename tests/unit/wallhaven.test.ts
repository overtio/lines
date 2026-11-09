import { describe, expect, mock, test } from "bun:test";
import type { PictureLibrary } from "../../src/lib/plugins/types";
import { stubApp } from "./stubs";

const answers = new Map<string, unknown>();
stubApp({
  isTauri: true,
  webFetch: async () => async (url: string) => {
    const answer = [...answers].find(([start]) => url.startsWith(start))?.[1];
    if (answer === undefined) return new Response("", { status: 404 });
    return answer instanceof Blob ? new Response(answer) : Response.json(answer);
  },
});
// The note's "/" menu and picker, which the plugin hands its library to.
mock.module("../../src/lib/editor/slashCommands", () => ({ named: (key: string) => ({ id: key, name: key, keywords: "" }), SECTIONS: { insert: {} } }));
mock.module("../../src/lib/editor/webImages", () => ({ pickWebImage: () => () => {} }));
const { searchUrl, wallhaven } = await import("../../src/plugins/wallhaven");

/** A wallpaper as Wallhaven's search gives it (trimmed). */
const wallpaper = (id: string) => ({
  id,
  url: `https://wallhaven.cc/w/${id}`,
  path: `https://w.wallhaven.cc/full/${id.slice(0, 2)}/wallhaven-${id}.jpg`,
  resolution: "1920x1080",
  colors: ["#424153", "#999999"],
  thumbs: { large: `https://th.wallhaven.cc/lg/${id}.jpg`, small: `https://th.wallhaven.cc/small/${id}.jpg` },
});

describe("Wallhaven", () => {
  const library = wallhaven().contributes.pictureLibraries![0] as PictureLibrary;

  test("asks only for what's safe for work: by relevance for words, the month's top for none", () => {
    const words = new URL(searchUrl("mountain lake", 2)).searchParams;
    expect([words.get("q"), words.get("purity"), words.get("sorting"), words.get("page")]).toEqual(["mountain lake", "100", "relevance", "2"]);
    const none = new URL(searchUrl("", 1)).searchParams;
    expect([none.get("q"), none.get("purity"), none.get("sorting"), none.get("topRange")]).toEqual([null, "100", "toplist", "1M"]);
  });

  test("finds wallpapers, described by the words they were found with, and more pages while there are", async () => {
    answers.set("https://wallhaven.cc/api/v1/search", { data: [wallpaper("q6xwxd"), wallpaper("abc123")], meta: { current_page: 1, last_page: 3 } });
    const page = await library.search("mountain lake", 1, new AbortController().signal);
    expect(page.more).toBe(true);
    expect(page.items[0]).toEqual({ id: "q6xwxd", thumb: "https://th.wallhaven.cc/small/q6xwxd.jpg", color: "#424153", src: "https://wallhaven.cc/w/q6xwxd", alt: "Mountain lake" });
    const none = await library.search("", 3, new AbortController().signal);
    expect(none.items[0].alt).toBe("plugins.wallhaven.wallpaper");
  });

  test("gives a chosen wallpaper's whole picture", async () => {
    answers.set("https://w.wallhaven.cc/full/q6/wallhaven-q6xwxd.jpg", new Blob(["jpeg bytes"], { type: "image/jpeg" }));
    const [found] = (await library.search("lake", 1, new AbortController().signal)).items;
    expect(await (await library.picture(found)).text()).toBe("jpeg bytes");
    expect(library.picture({ ...found, id: "never-found" })).rejects.toThrow();
  });

  test("says when Wallhaven doesn't answer", async () => {
    answers.clear();
    expect(library.search("lake", 1, new AbortController().signal)).rejects.toThrow();
  });
});
