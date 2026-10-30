/** The version in package.json, set at build time (vite.config.ts). */
declare const __APP_VERSION__: string;

interface Window {
  /** Where Excalidraw loads its fonts from (DrawingEditor.svelte). */
  EXCALIDRAW_ASSET_PATH?: string | string[];
}
