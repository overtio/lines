/** The version in package.json, set at build time (vite.config.ts). */
declare const __APP_VERSION__: string;

interface Window {
  /** Where Excalidraw loads its fonts from (DrawingEditor.svelte). */
  EXCALIDRAW_ASSET_PATH?: string | string[];
  /** Picks a color from anywhere on the screen: Chromium's, which TypeScript's DOM types don't have yet. */
  EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
}

/** The messages each of Settings' sections shows, by its id, for its search, each with the part it's in (vite.config.ts). */
declare module "virtual:settings-search" {
  const index: Record<string, Record<string, string>>;
  export default index;
}
