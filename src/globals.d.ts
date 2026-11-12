/** The version in package.json, set at build time (vite.config.ts). */
declare const __APP_VERSION__: string;

interface Window {
  /** Where Excalidraw loads its fonts from (DrawingEditor.svelte). */
  EXCALIDRAW_ASSET_PATH?: string | string[];
}

/** The messages each of Settings' sections shows, by its id, for its search (vite.config.ts). */
declare module "virtual:settings-search" {
  const index: Record<string, string[]>;
  export default index;
}
