# lines

A local-first notes app: Svelte 5, CodeMirror 6, Tauri 2. See README.md for the layout of the code.

## Keep the docs and QA set current

When a change adds or changes something users can see, update these in the same change (details in qa/README.md):

- **Markdown syntax, or how lines reads Markdown:** `docs/linedown.md`, and `ELEMENTS` / `CONTAINERS` in `scripts/qa-notes.mjs`. Then run `bun run qa-notes` to regenerate `qa/notes/`. Don't edit `qa/notes/` by hand.
- **Interactions** (shortcuts, buttons, menus, gestures, settings, behaviour): `qa/checklist.md`. A keyboard shortcut added or changed also goes in `src/lib/shortcuts.ts`, the list Settings → Shortcuts shows.
- **Features worth showing:** the feature tour in `src/lib/notes/tour/` (the web app's first notes on the website), the README's feature list, the website's home page (`site/home.mjs`; `bun site/screenshots.mjs` takes its pictures again), and `src/lib/notes/welcome.ts`.
- **Known limits and planned work:** `docs/limitations.md` and the README roadmap.
- **A new page in `docs/`:** a row in the README's Documentation tables, which are the website's list of docs (`site/`); `bun site/build.mjs` checks every link.
- **A plugin added or changed, or something new plugins can add:** `docs/plugins.md`, and the list in `src/plugins/index.ts`. Formats, engines, themes and icon sets are plugins: code outside a plugin asks the registry (`src/lib/plugins/`) rather than checking for one.
- **Text the app shows (labels, tooltips, aria-labels, messages):** a message in `src/lib/i18n/locales/en/` looked up with `t()`, with its Spanish and French; `bun run i18n` lists any missing. See `docs/translations.md`.
- **Anything people interact with:** keep it usable by keyboard and screen reader, as `docs/accessibility.md` describes.

## UI

- Components are styled with Tailwind utilities on the tokens in `src/app.css` (the theme's colors, one scale of radii, type and control heights). No other colors: themes are plugins, and everything follows the one chosen.
- Interactive parts (menus, dialogs, popovers, selects, switches, sliders, radio groups, tabs) are Bits UI. Use the shared parts in `src/lib/components/ui/` (Button, IconButton, Switch, Select, Slider, Segmented, TextField, FieldGroup, FieldRow, Callout…) rather than styling a new one; add to them when something's missing.
- Settings: a section per file in `src/lib/components/settings/`, listed in `sections.ts`; each is FieldGroups of FieldRows.
- What CodeMirror draws in a note is styled by `src/lib/editor/editor.css`, not Tailwind.

## Commits, pull requests and releases

Follow [CONTRIBUTING.md](CONTRIBUTING.md): main is protected, so every change comes through a pull request, from a branch of its own, one change each, whose title is a Conventional Commit (`fix(sync): keep edits made while a pass is running`), since it becomes the commit on main and the release notes. Its description follows the template: what and why, how it was checked and where, what wasn't tried. Don't bump versions or edit `CHANGELOG.md`; the release pull request does both ([docs/releasing.md](docs/releasing.md)).

## Checks

```sh
bun run check
bun run lint
bun run build
```

For changes that could make lines slower (the note list, the notes store, the editor, spreadsheets), run `bun run bench` before and after; see `docs/performance.md`.
