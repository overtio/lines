# Where lines keeps your data on the web

This covers the web app, including the demo at https://overtio.github.io/lines/app/. Everything stays in the browser, on the visitor's computer. The site's host (GitHub Pages) only serves the app's files, and the app never sends notes anywhere. The exception is sync, when someone sets it up: to a folder they choose, or to their own S3 bucket (not offered on the demo website).

All of it can be inspected in the browser's developer tools (in Chrome: Application → Storage).

## In the browser

Browser storage belongs to one site (origin) in one browser profile. Another browser, a private window or another computer starts empty, and the demo website starts again with the feature tour. Settings → Export and Import → Start Again goes back to the tour and the examples in the same browser, deleting the notes there first.

### IndexedDB

| Database | Store | What's in it |
|---|---|---|
| `lines` | `notes` | Every note: its Markdown, dates, pin, trash, icon, and for a locked note its encrypted text |
| `lines` | `attachments` | Images and files added to notes, named by their content hash |
| `lines` | `sync` | What was last exchanged with the sync folder or bucket, per note, to tell which side changed |
| `lines-folders` | `folders` | The browser's handle to the folder chosen with **Save to a folder**, so lines can use it again after a reload |
| `lines-feeds` | `feeds` | Each feed subscribed to: what it said of itself and what it's written in (RSS, Atom or RSS 1.0, for the sidebar's rows by kind), its newest 200 posts (all but their content), which were read, and its ETag and Last-Modified for asking whether it changed |
| `lines-feeds` | `posts` | Each post's content, as the feed gave it (HTML), read when the post is opened |
| `lines-feeds` | `positions` | Where each podcast episode was stopped, and whether it was played to the end; the episode in the player, to put back after the app lock or a restart; and where each book kept with a note was left, and how far it's been read, by the note |

With the app lock on, the notes and attachments in `lines` and everything in `lines-feeds` are encrypted (see [sync.md](sync.md) and `src/lib/lock/vault.ts`). `lines-feeds` keeps each record under a random id (a feed's, a post's, an episode's note's), so nothing there says what's subscribed to or listened to. It isn't synced: subscriptions are notes and sync as notes do, and each device fetches the posts itself.

### localStorage

| Key | What's in it |
|---|---|
| `lines.prefs` | Theme, appearance, font (one of lines' or one installed on the device, by its name) and formatting's fonts, text size, note width, spacing, icon set, layout, symbols, spreadsheets, links, whether links are looked up (the Library), how often feeds refresh, the podcast player's speed, whether books are read a page at a time or scrolled and a PDF's pages in the theme's colors |
| `lines.language` | The language chosen in Settings, unless it's System |
| `lines.plugins` | Plugins turned off or on in Settings |
| `lines.tabs` | The open tabs, when tabs are on |
| `lines.tagIcons`, `lines.typeIcons` | Icons given to tags and types |
| `lines.sync` | Where notes sync to: the folder (its name and an id for its handle) or the bucket and its keys. Encrypted while the app lock is on |
| `lines.sync.leftovers` | Set only while encrypted copies are being removed after turning end-to-end encryption off |
| `lines.seeded` | That the welcome note or feature tour has been added once, so deleting them doesn't bring them back |
| `lines.unsaved.<id>` | A note typed in just before the page went (a tab closed or reloaded, lines quit), until it's in `lines`: stored at the next start unless what's there is newer. Never a locked note, nor anything while the app lock is on |
| `lines.lock` | The app lock's settings, and its key locked with the passphrase |
| `lines.lockedNotes` | Locked notes' key, locked with their password, and whether Touch ID opens them |

## In a folder

After **Save to a folder** (Chrome, Edge and other Chromium browsers), lines also writes everything to that folder and keeps it in step with the browser, both ways:

```
<folder>/
  notes/<id>.md          One per note: front matter (id, dates, pin, trash, icon, format), then its Markdown, LaTeX or spreadsheet
  attachments/<hash>.<ext>
```

The format is described in [sync.md](sync.md). The browser stays the working copy; the folder is a copy that other apps can read, and that outlives the browser's storage.

## How long it lasts

Browser storage isn't permanent:

- **Clearing site data** (or cookies and site data for the site) deletes the notes in the browser.
- **The browser can evict it** when the disk runs low. lines doesn't ask for persistent storage (`navigator.storage.persist()`), so it's "best effort" storage.
- **Safari** deletes the storage of a site that hasn't been visited for 7 days.

For notes that should last, use **Save to a folder**, or export them (Settings → Export and Import → Export).

## Shared with other sites on the same domain

Browsers keep storage apart by domain, not by path. The demo is at `overtio.github.io/lines/app/`, so its storage belongs to `overtio.github.io` and is shared with every other GitHub Pages site under the overtio account: any of them could read the `lines` database and the `lines.*` keys. That's fine for a demo. Before hosting anything else there, or encouraging people to keep real notes on the demo site, move it to a domain of its own (for example a custom domain for the Pages site).

## What the host sees

GitHub Pages sees ordinary request logs, as for any site: IP address, browser, and which files were loaded. It never sees what's written in the notes.
