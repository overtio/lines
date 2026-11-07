# Contributing to lines

Thanks for helping. This is how changes get into lines, for people and for coding agents alike: setting up, making a change, and the commits and pull requests main takes.

## Setting up

You need [Bun](https://bun.com) 1.4+, [Node.js](https://nodejs.org) 22+ (Vite, svelte-check and Tauri's CLI run on it), and for the desktop apps [Rust](https://rustup.rs) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
bun install          # only package versions at least 10 days old (bunfig.toml)
bun run dev          # the web app, at http://localhost:1420
bun run tauri dev    # the desktop app
```

## Making a change

1. Branch from main, named for the change: `fix/sync-lost-edit`, `feat/spreadsheet-sort`.
2. Make one change. Something users can see updates its docs, the QA checklist and the feature tour in the same change; [CLAUDE.md](CLAUDE.md) lists which file covers what. Text the app shows is translated; anything people use works by keyboard and screen reader ([docs/accessibility.md](docs/accessibility.md)).
3. Check it:

   ```sh
   bun run check    # types
   bun run lint     # Oxlint
   bun run build
   bun run i18n     # every message translated
   ```

   And, when they apply: `bun run qa-notes` after changing how Markdown is read (commit the notes it writes), `bun run bench` before and after anything that could make lines slower ([docs/performance.md](docs/performance.md)), and `cargo clippy` and `cargo test` in `src-tauri/` after changing Rust.
4. Try it where people will use it. A change to what people see or do is tried in WebKit (Safari, or the Mac app) as well as Chrome, as they differ; say in the pull request where it wasn't tried.
5. Open a pull request (below).

## Commits and pull requests

main is protected: every change, a maintainer's too, comes in through a pull request whose checks pass. Pull requests are squash-merged, so **a pull request's title becomes its commit on main**, and its description the commit's body. Commits within a pull request can be as many as you like; only the title has to follow the convention.

### The title

[Conventional Commits](https://www.conventionalcommits.org): `type(scope): what changed`.

```
feat(spreadsheets): fill a series by dragging the selection's corner
fix(sync): keep edits made while a pass is running
perf(list): draw only the notes in view
docs: say how releases are made
```

| Type | For | Makes a release |
|---|---|---|
| `feat` | Something new people can do or see | yes, minor (0.2.0 → 0.3.0) |
| `fix` | Something that didn't work as it should | yes, patch (0.2.0 → 0.2.1) |
| `perf` | The same, faster or lighter | yes, patch |
| `refactor` | Code changed, behaviour not | no |
| `docs` | Documentation only | no |
| `test` | Tests and benchmarks | no |
| `build` | Dependencies, the build, packaging | no |
| `ci` | Workflows | no |
| `chore` | Anything else that isn't the app | no |
| `revert` | Undoing an earlier change (`revert: feat(list): …`) | as what it undoes |
| `style` | Formatting only | no |

- **Scope** (optional): the part of lines it's about, as a folder or doc names it: `editor`, `list`, `notes`, `sync`, `spreadsheets`, `latex`, `pdf`, `settings`, `plugins`, `themes`, `i18n`, `a11y`, `native` (the Rust side), `bench`, `release`, `deps`.
- **What changed**: plain words, as someone using lines would put it, starting in lower case, no full stop, the whole title within 100 characters. The title says what; the description says why.
- **Breaking changes**: anything that makes people or plugins do something (notes, sync or the plugin API changing in a way older versions can't read): `!` after the type or scope (`feat(sync)!: …`), and a paragraph in the description starting `BREAKING CHANGE:` that says what to do. Before 1.0 it makes a minor release.

The `conventions` check fails on a title that doesn't follow this; `bun scripts/release.mjs check-title "…"` checks one locally.

### The description

The pull request template asks for it: what changed and why, how it was checked (what was run, and tried where), and the checklist. Link the issue it closes (`Closes #123`). Screenshots or a recording for anything that looks or moves differently.

### Checks

Every pull request runs [`.github/workflows/checks.yml`](.github/workflows/checks.yml), and has to pass:

- `conventions`: the title
- `cla`: everyone who contributed to it has agreed to the [contributor agreement](CLA.md)
- `web`: types, lint, translations, QA notes up to date, the build
- `rust (macos-latest)`, `rust (windows-latest)`, `rust (ubuntu-22.04)`: Clippy (warnings fail) and the tests, for each desktop system

### Coding agents

The same rules, and:

- Never push to main; open a pull request. Don't merge one unless asked to.
- The person you work for agrees to the contributor agreement; it covers what you contribute for them.
- One change per pull request, from a branch of its own.
- Say what you verified and how, and what you couldn't (the Mac app, a phone, a real sync provider). Don't describe a check you didn't run.
- Name yourself: a `Co-authored-by:` trailer for the agent in commits you write, and a line at the end of the description saying which agent made it.
- Don't bump versions or edit `CHANGELOG.md`: the release pull request does both.

## Contributor agreement

Before your first pull request is merged, you agree to lines' [contributor agreement](CLA.md): a bot asks on the pull request, and you reply with the sentence it gives. Once covers everything you contribute afterwards.

You keep the copyright in what you contribute. You give lines' maintainer a broad license to it, and every version of lines that includes it stays open source. lines asks because it's under the AGPL: without the agreement, every contributor's code could only be passed on under the AGPL's terms, and Apple's App Store terms (iPhone, iPad, the Mac App Store) add restrictions the AGPL doesn't allow, so lines couldn't be published there, nor its license ever changed.

Contributing for an employer: make sure you may, as the agreement asks you to confirm. A coding agent's pull request is covered by the person it works for, who agrees once on their own account.

## Releases

Merging into main never releases by itself. A bot keeps a pull request titled `chore(release): v…` open, with the next version worked out from the merged titles above and the changelog written from them; merging it tags the release and builds the apps. [docs/releasing.md](docs/releasing.md) has the details.

## Dependencies

Only versions published at least 10 days ago are installed (`bunfig.toml`), so a compromised release has time to be caught; Dependabot proposes updates weekly under the same rule. A new dependency needs a reason in its pull request, a license that fits the AGPL, and `bun run notices` (the third-party licenses lines shows in About).
