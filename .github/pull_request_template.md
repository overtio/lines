<!--
The title becomes the commit on main: type(scope): what changed, e.g.
fix(sync): keep edits made while a pass is running. See CONTRIBUTING.md.
-->

## What and why

<!-- What changes for people using lines, and why. "Closes #123" if it does. -->

## How it was checked

<!-- What you ran, and what you tried where: Chrome, Safari or the Mac app, a phone, a sync provider. Say what wasn't tried. -->

## Checklist

- [ ] I've agreed to the [contributor agreement](https://github.com/overtio/lines/blob/main/CLA.md) (the bot asks on a first pull request)
- [ ] `bun run check`, `bun run lint` and `bun run build` pass
- [ ] Docs, the QA checklist and the feature tour are updated where people will see the change (CLAUDE.md lists which)
- [ ] Text the app shows is translated (`bun run i18n`)
- [ ] Usable by keyboard and screen reader
- [ ] `bun run bench` before and after, if it could make lines slower
- [ ] Screenshots or a recording, if it changes what people see
- [ ] A breaking change has `!` in the title and a `BREAKING CHANGE:` paragraph saying what to do
