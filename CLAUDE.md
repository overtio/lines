# lines

A local-first notes app: Svelte 5, CodeMirror 6, Tauri 2. See README.md for the layout of the code.

## Keep the docs and QA set current

When a change adds or changes something users can see, update these in the same change (details in qa/README.md):

- **Markdown syntax, or how lines reads Markdown:** `docs/linedown.md`, and `ELEMENTS` / `CONTAINERS` in `scripts/qa-notes.mjs`. Then run `pnpm qa-notes` to regenerate `qa/notes/`. Don't edit `qa/notes/` by hand.
- **Interactions** (shortcuts, buttons, menus, gestures, settings, behaviour): `qa/checklist.md`. A keyboard shortcut added or changed also goes in `src/lib/shortcuts.ts`, the list Settings → Shortcuts shows.
- **Features worth showing:** the feature tour in `src/lib/notes/tour/` (the demo website's first notes), the README's feature list, and `src/lib/notes/welcome.ts`.
- **Known limits and planned work:** `docs/limitations.md` and the README roadmap.
- **A plugin added or changed, or something new plugins can add:** `docs/plugins.md`, and the list in `src/plugins/index.ts`. Formats, engines, themes and icon sets are plugins: code outside a plugin asks the registry (`src/lib/plugins/`) rather than checking for one.
- **Text the app shows (labels, tooltips, aria-labels, messages):** a message in `src/lib/i18n/locales/en/` looked up with `t()`, with its Spanish and French; `pnpm i18n` lists any missing. See `docs/translations.md`.
- **Anything people interact with:** keep it usable by keyboard and screen reader, as `docs/accessibility.md` describes.

## Checks

```sh
pnpm check
pnpm build
```
