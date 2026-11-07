// Versions and releases (docs/releasing.md). Run with Bun (`bun scripts/release.mjs …`):
//
//   check-title "<title>"   whether a pull request's title (or a commit's subject) follows the
//                           commit convention (CONTRIBUTING.md); exits 1, saying why, if not
//   next                    the next version, worked out from the commits since the last release
//   prepare                 writes that version into the files that carry it and adds its notes to
//                           CHANGELOG.md; prints `version=…` (for GitHub Actions), or nothing
//                           when nothing since the last release calls for one
//   notes <version>         that version's notes from CHANGELOG.md, for its GitHub release
//
// The version is in package.json (the app's About shows it), src-tauri/tauri.conf.json,
// src-tauri/Cargo.toml and src-tauri/Cargo.lock; releases are tagged `v0.2.0`.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "https://github.com/overtio/lines";
const CHANGELOG = join(root, "CHANGELOG.md");

const TYPES = ["feat", "fix", "perf", "refactor", "docs", "test", "build", "ci", "chore", "revert", "style"];
/** `type(scope)!: subject`, the scope and `!` optional. */
const CONVENTIONAL = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9][a-z0-9 ,/-]*)\))?(?<breaking>!)?: (?<subject>\S.*)$/;
const MAX_TITLE = 100;
/** A release's own commit, which the release workflow tags (` (#45)` is GitHub's, on a squash merge). */
const RELEASE_TITLE = /^chore\(release\): v(?<version>\d+\.\d+\.\d+)(?: \(#\d+\))?$/;
/** What GitHub adds to a squash-merged pull request's title. */
const PR_NUMBER = /\s*\(#(\d+)\)$/;

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const read = (path) => readFileSync(join(root, path), "utf8");
const write = (path, text) => writeFileSync(join(root, path), text);

/** Why `title` doesn't follow the convention, or null if it does. */
function titleProblem(title) {
  const match = CONVENTIONAL.exec(title);
  if (!match) return `"${title}" isn't "type(scope): what changed", e.g. "fix(sync): keep edits made while a pass runs".`;
  if (!TYPES.includes(match.groups.type)) return `"${match.groups.type}" isn't one of the types: ${TYPES.join(", ")}.`;
  if (title.replace(PR_NUMBER, "").length > MAX_TITLE) return `It's ${title.length} characters; keep it to ${MAX_TITLE}, and put the rest in the description.`;
  if (title.endsWith(".")) return "Leave out the full stop at the end.";
  return null;
}

/** The last release's tag (`v0.2.0`), if there's been one. */
function lastTag() {
  try {
    return git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*");
  } catch {
    return null;
  }
}

/** The commits since `tag` (every one, before the first release), newest first. */
function commitsSince(tag) {
  const log = git("log", "--format=%s%x1f%b%x1e", ...(tag ? [`${tag}..HEAD`] : []));
  return log
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [subject, body = ""] = entry.split("\x1f");
      // Only the convention's own types: "lines: …", from before it, is a plain subject.
      const match = CONVENTIONAL.exec(subject);
      if (match && !TYPES.includes(match.groups.type)) return { subject, body, breaking: false };
      const breaking = !!match?.groups.breaking || /^BREAKING[ -]CHANGE: /m.test(body);
      return { subject, body, ...match?.groups, breaking };
    })
    .filter((commit) => !RELEASE_TITLE.test(commit.subject));
}

const parse = (version) => version.split(".").map(Number);

/**
 * The version after `current` that `commits` call for, or null for none. Before 1.0, a breaking
 * change or a feature makes a minor release (0.2.0 → 0.3.0) and a fix a patch; from 1.0 on, a
 * breaking change makes a major one.
 */
function bump(current, commits) {
  const [major, minor, patch] = parse(current);
  if (commits.some((c) => c.breaking)) return major === 0 ? `0.${minor + 1}.0` : `${major + 1}.0.0`;
  if (commits.some((c) => c.type === "feat")) return `${major}.${minor + 1}.0`;
  if (commits.some((c) => c.type === "fix" || c.type === "perf")) return `${major}.${minor}.${patch + 1}`;
  return null;
}

/** A commit as a line of release notes, its pull request linked. */
function noteLine({ scope, subject }) {
  const text = subject.replace(PR_NUMBER, (_, n) => ` ([#${n}](${REPO}/pull/${n}))`);
  return `- ${scope ? `**${scope}:** ` : ""}${text}`;
}

/** The notes for a release: its breaking changes, features, fixes and speed-ups. */
function notes(commits, first) {
  const sections = [
    ["Breaking changes", commits.filter((c) => c.breaking)],
    ["Features", commits.filter((c) => c.type === "feat" && !c.breaking)],
    ["Fixes", commits.filter((c) => c.type === "fix" && !c.breaking)],
    ["Performance", commits.filter((c) => c.type === "perf" && !c.breaking)],
    // Before the convention, commits said what changed in their own words.
    ["Changes", first ? commits.filter((c) => !c.type) : []],
  ];
  return sections
    .filter(([, list]) => list.length)
    .map(([title, list]) => `### ${title}\n\n${list.map(noteLine).join("\n")}`)
    .join("\n\n");
}

/** The next release: its version and notes, or null when nothing calls for one. */
function next() {
  const tag = lastTag();
  const current = JSON.parse(read("package.json")).version;
  const commits = commitsSince(tag);
  // The first release is the version package.json has.
  const version = tag ? bump(tag.slice(1), commits) : current;
  if (!version) return null;
  return { version, previous: tag, notes: notes(commits, !tag) };
}

/** Writes `version` into every file that carries it. */
function setVersion(version) {
  const replace = (path, pattern, label) => {
    const text = read(path);
    if (!pattern.test(text)) throw new Error(`No ${label} in ${path}`);
    write(path, text.replace(pattern, `$1${version}$2`));
  };
  replace("package.json", /("version": ")[^"]+(")/, "version");
  replace("src-tauri/tauri.conf.json", /("version": ")[^"]+(")/, "version");
  replace("src-tauri/Cargo.toml", /(\[package\][^[]*?\nversion = ")[^"]+(")/, "[package] version");
  replace("src-tauri/Cargo.lock", /(\nname = "lines"\nversion = ")[^"]+(")/, "lines package");
}

const HEADER = "# Changelog\n\nWhat changed in each release of lines. Written by `bun scripts/release.mjs prepare` from the commits since the release before (docs/releasing.md).\n";

/** Adds a release's notes at the top of CHANGELOG.md. */
function addToChangelog({ version, previous, notes: body }) {
  const date = new Date().toISOString().slice(0, 10);
  const link = previous ? `${REPO}/compare/${previous}...v${version}` : `${REPO}/releases/tag/v${version}`;
  const section = `## [${version}](${link}) (${date})\n\n${body || "Maintenance."}\n`;
  const text = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, "utf8") : HEADER;
  const at = text.indexOf("\n## ");
  writeFileSync(CHANGELOG, at < 0 ? `${text.trimEnd()}\n\n${section}` : `${text.slice(0, at + 1)}${section}\n${text.slice(at + 1)}`);
}

/** A version's notes, as CHANGELOG.md has them. */
function notesOf(version) {
  const text = readFileSync(CHANGELOG, "utf8");
  const start = text.indexOf(`\n## [${version}]`);
  if (start < 0) throw new Error(`CHANGELOG.md has no ${version}`);
  const body = text.slice(text.indexOf("\n", start + 1) + 1);
  const end = body.indexOf("\n## ");
  return (end < 0 ? body : body.slice(0, end)).trim();
}

const [command, arg] = process.argv.slice(2);
if (command === "check-title") {
  const problem = titleProblem(arg ?? "");
  if (problem) {
    console.error(`${problem}\nSee "Commits and pull requests" in CONTRIBUTING.md.`);
    process.exit(1);
  }
  console.log(`"${arg}" follows the convention.`);
} else if (command === "next" || !command) {
  const release = next();
  console.log(release ? `${release.version}\n\n${release.notes}` : "Nothing since the last release calls for a new one.");
} else if (command === "prepare") {
  const release = next();
  if (release) {
    setVersion(release.version);
    addToChangelog(release);
    console.log(`version=${release.version}`);
  }
} else if (command === "notes") {
  console.log(notesOf(arg));
} else {
  console.error(`Unknown command "${command}". See the top of scripts/release.mjs.`);
  process.exit(1);
}
