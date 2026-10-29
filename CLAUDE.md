# lines

A local-first notes app: Svelte 5, CodeMirror 6, Tauri 2. See README.md for the layout of the code.

## Keep the docs and QA set current

When a change adds or changes something users can see, update these in the same change (details in qa/README.md):

- **Markdown syntax, or how lines reads Markdown:** `docs/linedown.md`, and `ELEMENTS` / `CONTAINERS` in `scripts/qa-notes.mjs`. Then run `pnpm qa-notes` to regenerate `qa/notes/`. Don't edit `qa/notes/` by hand.
- **Interactions** (shortcuts, buttons, menus, gestures, settings, behaviour): `qa/checklist.md`.
- **Features worth showing:** the feature tour in `src/lib/notes/tour/` (the demo website's first notes), the README's feature list, and `src/lib/notes/welcome.ts`.
- **Known limits and planned work:** `docs/limitations.md` and the README roadmap.

## Checks

```sh
pnpm check
pnpm build
```
