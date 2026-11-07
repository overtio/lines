# Releasing

lines is released from GitHub: a bot keeps the next release's pull request ready, and merging it tags the version, builds the desktop apps and publishes them. Nobody bumps a version or writes release notes by hand; both come from the pull requests' titles ([CONTRIBUTING.md](../CONTRIBUTING.md#commits-and-pull-requests)).

## Versions

Versions are [semantic](https://semver.org) (`0.2.0`), tagged `v0.2.0`. While lines is in alpha (0.x), a new feature or a breaking change makes a minor release (0.2.0 → 0.3.0), and fixes and speed-ups a patch (0.2.0 → 0.2.1). From 1.0 on, a breaking change makes a major one. Only `feat`, `fix` and `perf` pull requests (and breaking changes) call for a release: documentation, refactoring, tests, CI and dependency updates alone don't.

The version is in `package.json` (the app's About shows it), `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`. `scripts/release.mjs` changes all four together.

## How a release happens

1. **Pull requests are merged into main.** Each push to main deploys the demo website (`website.yml`) and runs the checks (`checks.yml`).
2. **The release pull request follows.** After each merge, `release-pr.yml` works out the next version from the titles merged since the last release (`bun scripts/release.mjs prepare`). It opens, or updates, a pull request titled `chore(release): v0.3.0` from the branch `release/next`, with the four files bumped and the release's notes added to the top of `CHANGELOG.md`, grouped into breaking changes, features, fixes and performance, each linking its pull request. GitHub holds the checks of a pull request a workflow opens until someone approves them, so the workflow approves its own; if it can't, its run shows a warning, and a maintainer approves them from the pull request's Checks tab. When nothing merged calls for a release, it closes the pull request.
3. **A maintainer merges it** when it's time for a release (squash, as every pull request). Up to then it keeps up with what's merged; changes made to its `CHANGELOG.md` by hand last until the next merge redoes it, so make them just before merging.
4. **`release.yml` releases it.** On the merged `chore(release): v…` commit it:
   - tags `v0.3.0` and drafts a GitHub release named "lines 0.3.0", with the notes from `CHANGELOG.md` under a line on the alpha and on opening unsigned apps;
   - builds the desktop apps from the tag, with TeX included and Unsplash's and GIPHY's keys from the repository's secrets: a universal Mac app (`.dmg`, Apple silicon and Intel), Windows (`.msi` and a `-setup.exe`), and Linux (`.AppImage`, `.deb`, `.rpm`, built on Ubuntu 22.04 so they run on it and later);
   - attaches them to the release, and publishes it once every build has.

If a build fails, the release stays a draft with whatever was attached: fix the cause in a pull request, then re-run the failed job from the workflow run (it builds the tagged commit), or, if the fix has to be in the release, delete the draft and the tag and merge the next release pull request.

`bun scripts/release.mjs next` shows, locally, what the next release would be and its notes.

## The first release

There's been no release yet. The first release pull request is for 0.1.0, the version `package.json` has, and its notes list every change so far (the commits from before the convention under "Changes").

## Not done yet

- **Signing.** The apps aren't signed: macOS and Windows warn before opening a downloaded copy (the release notes say how to open it). Signing and notarizing the Mac app needs an Apple Developer ID; Windows needs a code-signing certificate. Both would be secrets the build job uses.
- **Updates.** The apps don't update themselves; Tauri's updater needs signed update files and a place to check for them, which can be the GitHub release.
- **iPhone, iPad and Android** builds, and their stores.
- **Linux on ARM.**

## Settings this relies on

Set once in the repository on GitHub:

- **Branch protection on main**: pull requests only, for administrators too; the checks required (`conventions`, `cla`, `web`, and `rust` on each system); squash merging only, the pull request's title and description becoming the commit.
- **The `cla-signatures` branch**, where `cla.yml` records who agreed to the contributor agreement (`signatures/cla.json`); protected from force pushes and deletion.
- **Actions → General → Workflow permissions**: "Allow GitHub Actions to create and approve pull requests", for the release pull request.
- **Pages**: Source set to GitHub Actions, for the demo website.
- **Secrets**: `UNSPLASH_ACCESS_KEY` and `GIPHY_API_KEY`, for the website and the apps.
