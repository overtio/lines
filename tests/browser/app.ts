import { expect } from "bun:test";
import type { Locator, Page } from "playwright";

/*
 * The app in a page of its own, for a browser test: fresh storage, Settings as given, and what the
 * test needs to drive it. setup.ts starts the server and the browser.
 */

export interface Options {
  /** Settings to start with, as they're stored (prefs.svelte.ts). */
  prefs?: Record<string, unknown>;
  /** The tour's notes, as a first visit has them. */
  tour?: boolean;
  scheme?: "light" | "dark";
  width?: number;
  height?: number;
}

export interface App {
  page: Page;
  /** What went wrong in the page: uncaught errors and console errors. */
  errors: string[];
  /** Opens a note with this text, in `format` (Markdown if left out). */
  open(body: string, format?: string): Promise<string>;
  /** Settings, at `section` (as the sidebar names it). */
  settings(section: string): Promise<Locator>;
  closeSettings(): Promise<void>;
  /** The open note's text. */
  text(): Promise<string | null>;
  /** A computed style of the first element `selector` matches. */
  style(selector: string, property: string): Promise<string>;
  /** The page's own attribute, `data-<name>`. */
  root(name: string): Promise<string | null>;
  close(): Promise<void>;
}

export const engine = () => globalThis.lines.engine;
/** ⌘ where the browser runs on a Mac, Ctrl elsewhere (WebKit on Linux too), as the app's shortcuts take them. */
export const mod = () => (process.platform === "darwin" ? "Meta" : "Control");

/** What a browser says in the console on its own, not about lines: WebKit on Linux doesn't know a viewport key the page sets. */
const NOISE = [/^Viewport argument key ".+" not recognized and ignored\.$/];

export async function openApp({ prefs = {}, tour = false, scheme = "light", width = 1280, height = 820 }: Options = {}): Promise<App> {
  const context = await globalThis.lines.browser.newContext({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 1 });
  if (engine() === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // Once, so a reload keeps what the test changed.
  await context.addInitScript(
    ([prefs, tour]) => {
      // Not in the blank page a tab starts as, which has no storage.
      if (location.protocol !== "http:" || sessionStorage.getItem("lines.test")) return;
      sessionStorage.setItem("lines.test", "1");
      if (!tour) localStorage.setItem("lines.seeded", "1");
      localStorage.setItem("lines.prefs", JSON.stringify(prefs));
    },
    [prefs, tour] as const,
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && !NOISE.some((noise) => noise.test(message.text())) && errors.push(message.text()));
  await page.goto(globalThis.lines.url);
  await page.waitForFunction(() => window.testing?.notes.ready);
  const dialog = page.getByRole("dialog");
  return {
    page,
    errors,
    open: (body, format) => page.evaluate(([body, format]) => window.testing.open(body, format), [body, format] as const),
    async settings(section) {
      if (!(await dialog.isVisible())) await page.getByRole("button", { name: "Settings", exact: true }).click();
      await dialog.getByRole("navigation").getByText(section, { exact: true }).first().click();
      return dialog;
    },
    async closeSettings() {
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
    },
    text: () => page.evaluate(() => window.testing.text()),
    style: (selector, property) => page.locator(selector).first().evaluate((element, property) => getComputedStyle(element).getPropertyValue(property), property),
    root: (name) => page.evaluate((name) => document.documentElement.getAttribute(`data-${name}`), name),
    close: () => context.close(),
  };
}

/** Chooses `option` in the segmented control or radio group labelled `label`. */
export const choose = (within: Locator, label: string, option: string) => within.getByRole("radiogroup", { name: label, exact: true }).getByRole("radio", { name: option, exact: true }).click();

/** Turns the switch labelled `label` on or off. */
export async function toggle(within: Locator, label: string, on: boolean) {
  const control = within.getByRole("switch", { name: label, exact: true });
  if ((await control.getAttribute("aria-checked")) !== String(on)) await control.click();
}

/** Nothing went wrong in the page. */
export const noErrors = (app: App) => expect(app.errors).toEqual([]);
