import { describe, expect, test } from "bun:test";
import { isFolder, isLocal, linkTo, nameOf, pathOf } from "../../src/lib/notes/localLinks";

describe("links to folders and files on this computer", () => {
  test("a folder's link ends in a slash, its path escaped as a URL needs", () => {
    expect(linkTo("/Users/me/My Projects", true)).toBe("file:///Users/me/My%20Projects/");
    expect(linkTo("/Users/me/notes.txt", false)).toBe("file:///Users/me/notes.txt");
    expect(linkTo("/Users/me/a#b (draft) 100%", true)).toBe("file:///Users/me/a%23b%20%28draft%29%20100%25/");
    expect(linkTo("/", true)).toBe("file:///");
  });

  test("Windows' paths, by drive", () => {
    expect(linkTo("C:\\Users\\me\\Work", true)).toBe("file:///C:/Users/me/Work/");
    expect(pathOf("file:///C:/Users/me/Work/")).toBe("C:\\Users\\me\\Work");
    expect(pathOf(linkTo("D:\\", true))).toBe("D:\\");
  });

  test("read back as the path they were made from", () => {
    for (const path of ["/Users/me/My Projects", "/Volumes/Drive/ünïcode", "/Users/me/a#b (draft) 100%"]) {
      expect(pathOf(linkTo(path, true))).toBe(path);
      expect(pathOf(linkTo(path, false))).toBe(path);
    }
    expect(pathOf("file://localhost/Users/me/")).toBe("/Users/me");
    expect(pathOf("file:///")).toBe("/");
  });

  test("only file URLs are, and a folder's is one ending in a slash", () => {
    expect([isLocal("file:///a/"), isLocal("FILE:///a"), isLocal("https://a.com/"), isLocal("../attachments/x.png")]).toEqual([true, true, false, false]);
    expect([isFolder("file:///a/"), isFolder("file:///a.txt"), isFolder("https://a.com/")]).toEqual([true, false, false]);
    expect(pathOf("https://example.com")).toBeNull();
    expect(pathOf("file:///%E0%A4%A")).toBeNull();
  });

  test("named after the last part of the path", () => {
    expect([nameOf("/Users/me/Projects"), nameOf("/Users/me/Projects/"), nameOf("C:\\Users\\me\\Work"), nameOf("/")]).toEqual(["Projects", "Projects", "Work", "/"]);
  });
});
