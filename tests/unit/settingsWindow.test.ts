import { expect, mock, test } from "bun:test";

/*
 * Where Settings opens in the desktop apps (windows/settings.svelte.ts): over the notes by default,
 * or in a window of its own if chosen; and moved there at once when it's chosen.
 */

const prefs = { settingsOpens: "overlay" as "overlay" | "window" };
const ui = { settings: null as string | null };
const opened: string[] = [];

mock.module("../../src/lib/platform", () => ({ isDesktopApp: true }));
mock.module("../../src/lib/prefs.svelte", () => ({ prefs }));
mock.module("../../src/lib/ui.svelte", () => ({ ui }));
mock.module("../../src/lib/i18n/index.svelte", () => ({ t: (key: string) => key }));
mock.module("../../src/lib/components/settings/sections", () => ({ sectionOf: (id: string | null) => id ?? "general" }));
mock.module("../../src/lib/windows/channel", () => ({ announce: async () => {}, onAnnounce: async () => () => {}, windowLabel: () => "main" }));
mock.module("@tauri-apps/api/dpi", () => ({ LogicalPosition: function LogicalPosition() {} }));
mock.module("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: class {
    static getByLabel = async () => null;
    constructor(_label: string, options: { url: string }) {
      opened.push(options.url);
    }
    once() {
      return Promise.resolve(() => {});
    }
  },
}));

const { openSettings, setSettingsOpens } = await import("../../src/lib/windows/settings.svelte");

test("Settings opens over the notes unless a window of its own is chosen, and moves there when it is", async () => {
  await openSettings("cursor");
  expect(ui.settings).toBe("cursor");
  expect(opened).toEqual([]);

  // Chosen in the dialog: it closes, and the window opens on General.
  await setSettingsOpens("window");
  expect(ui.settings).toBeNull();
  expect(opened).toEqual(["index.html?section=general"]);

  await openSettings("theme");
  expect(opened.at(-1)).toBe("index.html?section=theme");
  expect(ui.settings).toBeNull();
});
