import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Page } from "playwright";
import { type App, noErrors, openApp, type Options } from "./app";

/*
 * A post's discussion under it in the reader (Discussion.svelte), as the Hacker News plugin reads
 * it: Algolia's copy of a real story's thread (feeds/hn-story.json), ranked and counted by the
 * official API's story (feeds/hn-official.json). Every request is answered by the test.
 */

const fixture = (name: string) => readFileSync(new URL(`./feeds/${name}`, import.meta.url), "utf8");
const ICEWM = "50478515";
const COWAY = "50474959";
const WORKBENCH = "50488325";
const pageOf = (id: string) => `https://news.ycombinator.com/item?id=${id}`;
const APIS = /^https:\/\/(hn\.algolia\.com|hacker-news\.firebaseio\.com)\//;

let app: App;
afterEach(async () => {
  noErrors(app);
  await app.close();
});

/** What a test answers for a story: what Algolia and the official API say, or that they fail (500), haven't it (null), never answer, or answer late. */
type Answer = object | null | "fail" | "hang" | { late: object; after: number };
interface Story {
  algolia: Answer;
  official: Answer;
}

const icewm = () => JSON.parse(fixture("hn-story.json"));
const official = () => JSON.parse(fixture("hn-official.json"));

/** Each story as Hacker News has it, unless a test says otherwise: IceWM's thread, one comment on Coway's, none on Workbench's. */
const stories = (): Record<string, Story> => ({
  [ICEWM]: { algolia: icewm(), official: official() },
  [COWAY]: {
    algolia: { id: Number(COWAY), type: "story", author: "scottjg", children: [{ id: 1, type: "comment", author: "rgovostes", created_at_i: 1794520000, text: "Nice work.", children: [] }] },
    official: { kids: [1], descendants: 1 },
  },
  [WORKBENCH]: { algolia: { id: Number(WORKBENCH), type: "story", author: "tosh", children: [] }, official: { descendants: 0 } },
});

/** A comment, and a reply under it, down to `depth`. */
const chain = (depth: number, at = 1): object => ({
  id: 900_000 + at,
  type: "comment",
  author: `person${at}`,
  created_at_i: 1794550000 + at,
  text: `Depth ${at}: ${"a few words ".repeat(10)}`,
  children: at < depth ? [chain(depth, at + 1)] : [],
});

/**
 * Hacker News' feed subscribed to, its stories' discussions answered from `answers` (which a test
 * can change as it goes), and the IceWM post open. Gives the requests sent to the two APIs.
 */
async function openStory(answers = stories(), options: Options = {}) {
  app = await openApp({ timezone: "UTC", ...options });
  const page = app.page;
  const asked: string[] = [];
  const cors = { "access-control-allow-origin": "*" };
  await page.route("https://news.ycombinator.com/rss", (route) => route.fulfill({ body: fixture("hn.rss"), contentType: "application/rss+xml", headers: cors }));
  await page.route(APIS, async (route) => {
    const url = route.request().url();
    asked.push(url);
    const story = answers[/(\d+)(?:\.json)?$/.exec(url)![1]];
    let answer = url.includes("algolia") ? story.algolia : story.official;
    if (answer === "hang") return;
    if (answer && typeof answer === "object" && "late" in answer) {
      const { late, after } = answer as { late: object; after: number };
      await new Promise((resolve) => setTimeout(resolve, after));
      answer = late;
    }
    // The page may have given up on it meanwhile.
    const fulfilled = answer === "fail" ? route.fulfill({ status: 500, headers: cors }) : answer === null ? route.fulfill({ status: 404, body: "", headers: cors }) : route.fulfill({ json: answer, headers: cors });
    await fulfilled.catch(() => {});
  });
  await page.evaluate(() => {
    const opened: string[] = [];
    Object.assign(window, { opened, open: (url: string) => void opened.push(url) });
  });
  await page.evaluate(() => window.testing.feeds.subscribe("https://news.ycombinator.com/rss"));
  await page.evaluate(() => window.testing.notes.setFilter({ kind: "feeds" }));
  await openPost(page, "IceWM");
  return asked;
}

const openPost = (page: Page, title: string) => page.locator(".note-list").getByRole("button", { name: new RegExp(`^${title}`) }).first().click();
const opened = (page: Page) => page.evaluate(() => (window as unknown as { opened: string[] }).opened);
const region = (page: Page, name: string | RegExp = /^(\d+ comments?|Comments)$/) => page.getByRole("region", { name });
const headers = (page: Page) => region(page).locator("[data-fold]");
const focused = (page: Page) => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
const expanded = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute("aria-expanded"));

test("a Hacker News post's discussion is under it: ranked, threaded, the poster marked, only the story's id sent, its HTML only read", async () => {
  const answers = stories();
  const story = answers[ICEWM].algolia as ReturnType<typeof icewm>;
  // A comment that would run something and load a picture were its HTML put in the page, and one without a time.
  const first = story.children.find((comment: { id: number }) => comment.id === 50479019);
  first.children.push({ id: 1, type: "comment", author: "mallory", created_at_i: 1794550000, text: 'Look<img src="https://evil.example/x.png" onerror="window.pwned = true"><script>window.pwned = true</script>', children: [] });
  first.children.push({ id: 2, type: "comment", author: "timeless", text: "When?", children: [] });
  answers[ICEWM].official = { ...official(), descendants: 18 };
  const asked = await openStory(answers);
  const page = app.page;
  const thread = region(page, "17 comments");
  await thread.waitFor();

  // Only the story's id is sent, to each API.
  expect([...new Set(asked)].sort()).toEqual([`https://hacker-news.firebaseio.com/v0/item/${ICEWM}.json`, `https://hn.algolia.com/api/v1/items/${ICEWM}`]);
  // Said to screen readers once it's loaded.
  await expect(thread.getByRole("status").textContent()).resolves.toBe("17 comments");

  // In Hacker News' order (Algolia's is oldest first), each reply under what it answers; the poster's name marked.
  expect(await headers(page).first().textContent()).toContain("yjftsjthsd-h");
  const top = thread.locator(":scope > ul > li").first();
  expect(await top.locator(":scope > div > ul > li").count()).toBe(4);
  expect(await thread.getByRole("button", { name: /^inatreecrown2 ?, who posted it/ }).count()).toBe(2);
  // Quotes are quotes.
  expect(await thread.locator("blockquote").first().textContent()).toBe("treating this as a blast from the past.");
  // Hacker News counts more than Algolia gave: those it left out with what they answer.
  await thread.getByRole("button", { name: "1 more comment on Hacker News" }).waitFor();

  // Its HTML was only read: nothing in it ran or loaded, and no link in it is one the page itself could follow.
  expect(await thread.locator("img, script, a").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { pwned?: boolean }).pwned)).toBeUndefined();
  await thread.getByText("Look", { exact: true }).waitFor();
  // A comment without a time has none.
  expect(await headers(page).filter({ hasText: "timeless" }).locator("time").count()).toBe(0);

  // A comment folds away with its replies, saying how many.
  const header = headers(page).first();
  await header.click();
  await expect(header.getAttribute("aria-expanded")).resolves.toBe("false");
  expect(await header.textContent()).toContain("5 replies");
  expect(await top.locator(":scope > div > ul").count()).toBe(0);
  await header.click();

  // A link in a comment, and the discussion's own page, open in the browser.
  const link = thread.getByRole("link", { name: "https://en.wikipedia.org/wiki/LiteStep" });
  // Focused first, which brings it into view: Playwright can't scroll WebKit to a comment not laid out yet (content-visibility).
  await link.focus();
  await link.click();
  await thread.getByRole("button", { name: "Open on Hacker News" }).click();
  expect(await opened(page)).toEqual(["https://en.wikipedia.org/wiki/LiteStep", pageOf(ICEWM)]);

  // With the plugin off, the post only links to them.
  await page.evaluate(() => window.testing.plugins.setOn(window.testing.plugins.get("hacker-news")!, false));
  await thread.waitFor({ state: "detached" });
  await page.locator(".editor-pane .cm-post-byline .cm-lp-link", { hasText: "Comments" }).waitFor();
});

test("the keyboard: one stop for Tab, the arrows and J and K from comment to comment, folding, Home and End, a comment's links", async () => {
  await openStory();
  const page = app.page;
  await headers(page).first().waitFor();
  // One header is a stop for Tab, and links only in its comment.
  expect(await region(page).locator('[tabindex="0"]').count()).toBe(1);
  await region(page).getByRole("button", { name: "Open on Hacker News" }).focus();
  await page.keyboard.press("Tab");
  expect(await focused(page)).toStartWith("yjftsjthsd-h");
  // The keys are said with the first comment.
  expect(await page.evaluate(() => document.getElementById(document.activeElement!.getAttribute("aria-describedby")!)?.textContent)).toStartWith("Up and down arrows");

  await page.keyboard.press("ArrowDown");
  expect(await focused(page)).toStartWith("inatreecrown2");
  await page.keyboard.press("j");
  expect(await focused(page)).toStartWith("fho");
  await page.keyboard.press("k");
  expect(await focused(page)).toStartWith("inatreecrown2");
  // ← folds a comment with replies, then goes to what it answers; → unfolds it, then goes to its first reply.
  await page.keyboard.press("ArrowLeft");
  expect(await expanded(page)).toBe("false");
  await page.keyboard.press("ArrowDown");
  expect(await focused(page)).toStartWith("dead_hn_theory");
  await page.keyboard.press("ArrowLeft");
  expect(await focused(page)).toStartWith("yjftsjthsd-h");
  await page.keyboard.press("ArrowRight");
  expect(await focused(page)).toStartWith("inatreecrown2");
  await page.keyboard.press("ArrowRight");
  expect(await expanded(page)).toBe("true");
  // Enter and Space fold and unfold.
  await page.keyboard.press("Enter");
  expect(await expanded(page)).toBe("false");
  await page.keyboard.press("Space");
  expect(await expanded(page)).toBe("true");
  await page.keyboard.press("End");
  expect(await focused(page)).toStartWith("microtonal");
  await page.keyboard.press("Home");
  expect(await focused(page)).toStartWith("yjftsjthsd-h");
  // Still one stop for Tab: where the keyboard is.
  expect(await region(page).locator('[data-fold][tabindex="0"]').count()).toBe(1);

  // A comment's link is reached by Tab from it, and Enter opens it; another comment's isn't.
  await headers(page).filter({ hasText: "MithrilTuxedo" }).focus();
  const link = region(page).getByRole("link", { name: "https://en.wikipedia.org/wiki/LiteStep" });
  expect(await link.getAttribute("tabindex")).toBe("0");
  await page.keyboard.press("Tab");
  expect(await focused(page)).toBe("https://en.wikipedia.org/wiki/LiteStep");
  await page.keyboard.press("Enter");
  expect(await opened(page)).toEqual(["https://en.wikipedia.org/wiki/LiteStep"]);
  await headers(page).first().focus();
  expect(await link.getAttribute("tabindex")).toBe("-1");
});

test("the byline's Comments goes to the discussion, Page Down from the post goes on into it, and a backdrop's page holds both", async () => {
  await openStory(stories(), { prefs: { paperBackdrop: "dawn" } });
  const page = app.page;
  await headers(page).first().waitFor();
  await page.locator(".editor-pane .cm-post-byline .cm-lp-link", { hasText: "Comments" }).click();
  expect(await focused(page)).toStartWith("yjftsjthsd-h");
  expect(await opened(page)).toEqual([]);

  // One page for the post and its discussion, not a card for the post alone.
  const style = (selector: string, property: string, pseudo: string | null = null) =>
    page.locator(selector).first().evaluate((element, [property, pseudo]) => getComputedStyle(element, pseudo).getPropertyValue(property), [property, pseudo] as const);
  expect(await style(".editor-pane .post-page", "background-color")).not.toBe("rgba(0, 0, 0, 0)");
  expect(await style(".editor-pane .post-page .cm-content", "content", "::before")).toBe("none");

  await page.locator(".editor-pane .post-page").evaluate((element) => (element.parentElement!.scrollTop = 0));
  await page.locator(".editor-pane .cm-content").focus();
  await page.keyboard.press("PageDown");
  await page.waitForFunction(() => document.querySelector(".editor-pane .post-page")!.parentElement!.scrollTop > 100);
});

test("a slow or failing official API doesn't hold up the thread, shown then in Algolia's order", async () => {
  const answers = stories();
  answers[ICEWM].official = "hang";
  answers[COWAY].official = "fail";
  const started = Date.now();
  await openStory(answers);
  const page = app.page;
  await region(page, "15 comments").waitFor();
  expect(Date.now() - started).toBeLessThan(8000);
  expect(await headers(page).first().textContent()).toContain("microtonal");
  // Without its count, none said to be left out.
  expect(await region(page).getByText(/more comments? on Hacker News/).count()).toBe(0);

  await openPost(page, "Reverse engineering");
  await region(page, "1 comment").waitFor();
  // Which the browser says in the console.
  app.errors.length = 0;
});

test("a failure says so, with Try Again; nothing from Algolia yet, or no comments, says so once", async () => {
  const answers = stories();
  answers[ICEWM].algolia = "fail";
  answers[COWAY].algolia = null;
  await openStory(answers);
  const page = app.page;
  await region(page, "Comments").getByText("The comments couldn’t be loaded.").waitFor();
  answers[ICEWM].algolia = icewm();
  await region(page, "Comments").getByRole("button", { name: "Try Again" }).click();
  await region(page, "15 comments").waitFor();

  await openPost(page, "Reverse engineering");
  const coway = region(page, "Comments");
  await coway.getByText("The comments aren’t here yet. They’re on Hacker News.").first().waitFor();
  await expect(coway.getByRole("status").textContent()).resolves.toBe("The comments aren’t here yet. They’re on Hacker News.");
  expect(await coway.textContent()).not.toMatch(/0 comments|No comments yet|more comments? on/);

  await openPost(page, "FM-1 Workbench");
  await region(page, "Comments").getByText("No comments yet.").first().waitFor();
  app.errors.length = 0;
});

test("going to another post gives up on a discussion loading; one opened again is shown without asking again", async () => {
  const answers = stories();
  answers[ICEWM].algolia = { late: icewm(), after: 2000 };
  const asked = await openStory(answers);
  const page = app.page;
  const failed: string[] = [];
  page.on("requestfailed", (request) => failed.push(request.url()));
  await openPost(page, "Reverse engineering");
  await region(page, "1 comment").waitFor();
  for (let wait = 0; wait < 40 && !failed.includes(`https://hn.algolia.com/api/v1/items/${ICEWM}`); wait++) await page.waitForTimeout(50);
  expect(failed).toContain(`https://hn.algolia.com/api/v1/items/${ICEWM}`);
  // When IceWM's answer comes, it's not shown in its place.
  await page.waitForTimeout(2200);
  expect(await region(page, "1 comment").isVisible()).toBe(true);

  await openPost(page, "FM-1 Workbench");
  await region(page, "Comments").getByText("No comments yet.").first().waitFor();
  await openPost(page, "Reverse engineering");
  await region(page, "1 comment").waitFor();
  expect(asked.filter((url) => url.endsWith(`items/${COWAY}`))).toHaveLength(1);
});

/** Where each comment of a 14-deep thread is drawn at a width: its text's left edge and width, and whom it says it answers. */
async function deepThread(width: number, height: number) {
  const answers = stories();
  (answers[ICEWM].algolia as ReturnType<typeof icewm>).children.unshift(chain(14));
  answers[ICEWM].official = { ...official(), kids: [900_001, ...official().kids] };
  await openStory(answers, { width, height });
  const page = app.page;
  await headers(page).first().waitFor();
  return page.evaluate(() => {
    // Every comment laid out, to be measured: those out of view aren't (content-visibility).
    for (const comment of document.querySelectorAll<HTMLElement>("[data-comment]")) comment.style.contentVisibility = "visible";
    return [...document.querySelectorAll<HTMLElement>("[data-comment]")]
      .filter((comment) => comment.querySelector("p")?.textContent?.startsWith("Depth "))
      .map((comment) => {
        const text = comment.querySelector("p")!.getBoundingClientRect();
        const says = [...comment.querySelector("[data-fold]")!.querySelectorAll("span")].find((span) => span.textContent?.startsWith("↳"));
        return { left: Math.round(text.left), width: Math.round(text.width), says: says && getComputedStyle(says).display !== "none" ? says.textContent : null };
      });
  });
}

/** Replies drawn in up to `inline` levels, then in line with the last, each saying whom it answers. */
function expectDrawnIn(shapes: Awaited<ReturnType<typeof deepThread>>, inline: number) {
  expect(shapes).toHaveLength(14);
  for (const [depth, shape] of shapes.entries()) {
    if (depth < inline) {
      expect(shape.says).toBeNull();
      if (depth) expect(shape.left).toBeGreaterThan(shapes[depth - 1].left);
    } else {
      expect(shape.says).toBe(`↳ reply to person${depth}`);
      expect(shape.left).toBe(shapes[inline - 1].left);
    }
  }
}

test("a deep thread on a phone: replies drawn in four levels, deeper ones saying whom they answer", async () => {
  const shapes = await deepThread(390, 780);
  expectDrawnIn(shapes, 5);
  expect(Math.min(...shapes.map((shape) => shape.width))).toBeGreaterThan(200);
});

test("a deep thread where it's wider: replies drawn in seven levels", async () => {
  const shapes = await deepThread(1280, 820);
  expectDrawnIn(shapes, 8);
  expect(Math.min(...shapes.map((shape) => shape.width))).toBeGreaterThan(400);
});
