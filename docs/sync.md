# Sync with your own storage

lines syncs through storage you already have. There's no lines server and no account.

## Cloud drive (desktop apps)

In the Mac (and Windows/Linux) app, Settings → Sync → Cloud drive lists the drives on your computer: iCloud Drive, Google Drive, Proton Drive, Dropbox, OneDrive and Box. Pick one, or any folder. lines keeps your notes in a `lines` folder there, one Markdown file per note (`lines/notes/<note-id>.md`, the same format as a bucket), and the drive's own app carries them to your other computers. Connect lines on each of them to the same drive.

- lines only ever touches its own files in that one folder: `.md` notes and their attachments (or, with end-to-end encryption, `.enc` files and `encryption.json`).
- macOS asks once for permission to use the drive's folder.
- If iCloud hasn't downloaded a note to this Mac yet, lines asks it to and picks the note up on the next pass.
- A note's file another app saved with a byte order mark or Windows line endings, or as UTF-16, reads as usual. Bytes that aren't UTF-8 (a file saved as Latin-1, say) read as �, as they do from a bucket, rather than stop sync.
- The drive's app does the uploading, so lines doesn't need to be online, and conflicts are handled just like with a bucket.
- When the drive itself finds two versions of a note's file it can't merge, it keeps one under the note's name and the other beside it: `<note-id> (MacBook's conflicted copy 2026-11-09).md` (Dropbox), `<note-id> 2.md` (iCloud), `<note-id> (1).md` (Google Drive), `<note-id>-MacBook.md` (OneDrive). lines brings that one in as a “… (conflicted copy)” note, as for a conflict of its own (or nothing, if it says what the note does), and then deletes the drive's file: the copy syncs as a note of its own. Two devices bringing in the same file at once each make a copy.

On the web and on phones, use a bucket for now; signing in to iCloud, Google Drive and Proton Drive there is on the roadmap.

## S3-compatible bucket

lines can also sync through any S3-compatible object storage you control.

Tested API surface: `ListObjectsV2`, `GetObject`, `PutObject` (with `If-Match` and `If-None-Match` where the provider supports them), `DeleteObject`. Any provider that implements these with AWS Signature V4 should work:

- Cloudflare R2
- Backblaze B2
- Amazon S3
- MinIO, Wasabi, Tigris, DigitalOcean Spaces, Hetzner Object Storage, Garage, …

## How it works

Your notes are always stored on the device first. lines stays instant and works offline, and syncs in the background: about 2 seconds after you stop typing, every minute, when the app regains focus, and when you come back online.

Each note is a Markdown file in the bucket:

```
<bucket>/<folder>/notes/<note-id>.md
```

```markdown
---
id: 6f1c2a9e-…
created: 2026-10-28T14:43:00.000Z
updated: 2026-10-28T15:02:11.000Z
pinned: false
trashed: false
---
# My note

Plain Markdown, readable by any editor.
```

A note in the Inbox has an `inbox: true` line, and loses it once filed. A note with an icon has an `icon` line, and one with a color a `color` line. A note in another format has a `format` line, followed by its text: `format: latex` and its LaTeX ([latex.md](latex.md)), or `format: spreadsheet` and its title and CSV ([spreadsheets.md](spreadsheets.md#its-text)). A note imported from another app has a `source` line saying where it came from, as JSON ([importing.md](importing.md#importing-again)). A line lines doesn't know, a newer version's, is kept as it is and written back when the note changes.

Importing such a file (Settings → Export and Import → Import Files…) brings the note back as it was, with its id, unless a note on the device has that id; then it comes in as a note of its own, so an import never replaces one.

A note's own [properties](linedown.md#properties) are part of its text, so they come after this block, in a second one:

```markdown
---
id: 6f1c…
…
---
---
type: person
fullname: Oleksandr Litus
---
# Oleks
```

On each sync, lines compares every note with what it last exchanged with the bucket (the object's ETag and a hash of its content):

| Situation | What happens |
| --- | --- |
| Changed on this device | Uploaded |
| Changed on another device | Downloaded, including into an open editor. Into a floating note being typed in, it's an edit on both devices (below) |
| Edited on both | The newer edit wins, and the other is saved as a separate note titled “… (conflicted copy)”, its properties and type kept (a spreadsheet's mark goes on its title line, not in its cells, a LaTeX document's in its `\title`, and a code note's in the comment its title comes from, or in a comment of its own above the line of code it's read from, never in its code; a note in another format whose title can't be marked that way, or a code note whose comment would read as a tag, as a C note's `#include` would, keeps its text as it is). Nothing is lost. |
| Edited on one, pinned, moved to the trash, filed or put in the Inbox, given an icon or locked on the other | Both kept, in one note: pinning and the rest don't count as edits. A note locked on either device stays locked, the edit inside it (or, on a device that doesn't have the password, the edit as a conflicted copy) |
| Deleted on one device | Deleted on the others, unless another device edited it in the meantime, in which case the edit wins |

If every note that synced is gone from the bucket or folder at once, that's as likely a drive that's signed out or the wrong folder as every note deleted elsewhere, so lines changes nothing and sync stops until you say which, in Settings → Sync: **Delete them here too…** (asks first; notes edited here since they last synced are kept and uploaded), or **Upload them again**.

Images and files in notes sit next to them, named after their content and keeping their extension:

```
<bucket>/<folder>/attachments/<hash>.png
<bucket>/<folder>/attachments/<hash>.pdf
```

A note shows an image as `![](../attachments/<hash>.png)` and links a file as `[Report.pdf](../attachments/<hash>.pdf)`, so the folder reads correctly in other Markdown apps too. Since a name always means the same bytes, there's nothing to merge: each sync uploads the attachments your notes use that the bucket lacks, and downloads the ones this device lacks. Every device keeps a copy of every attachment, so large files take room everywhere. One no note uses any more is removed from the device at the next launch (one where lines isn't open in another tab, which could still bring it back with undo), but stays in the bucket for now.

The icons and colors chosen for tags and types are one small file beside the notes, `<bucket>/<folder>/library.json` (encrypted like a note when encryption is on). Each choice keeps when it was made, so devices merge them one by one, the later winning: an icon chosen for a tag on the phone and a color for a type on the Mac both stay. A choice undone is kept as undone, so that syncs too. Icons chosen before they synced are the device's until another device chooses for the same tag or type.

Only one sync pass runs at a time, even with lines open in several browser tabs, so a conflict makes one copy, not one per tab.

A note is only written over the version lines saw there a moment before, so an edit another device saves while this one syncs isn't overwritten: the next pass brings it in and compares, as above. In a bucket that's a conditional write (`If-Match`, or `If-None-Match` for a new note); a service that ignores those, or doesn't do them (it refuses a write over the very version it holds), is written to as before. In a cloud drive's folder, lines looks at the file again just before writing it.

Several devices can share one bucket and folder. To keep separate libraries in one bucket, use different folders.

## End-to-end encryption

Settings → Sync → **Set up encryption…** encrypts notes and attachments on the device before they're uploaded, so the bucket or drive (and whoever runs it) only ever holds files it can't read:

```
<bucket>/<folder>/encryption.json             the library key, locked with your passphrase
<bucket>/<folder>/notes/<note-id>.enc         a note, encrypted
<bucket>/<folder>/attachments/<name>.enc      an attachment, encrypted, under a keyed hash of its name
```

- Notes and attachments are encrypted with AES-256-GCM under a random library key. Your passphrase only locks that key (PBKDF2-SHA-256, 600,000 iterations), so changing the passphrase doesn't re-upload anything, and devices that already have the key keep syncing.
- Each file is bound to its name, so one note can't be swapped for another.
- Attachment names are hidden too: a content hash would show whether a known file is in your library.
- Still visible: how many notes and attachments there are, their sizes, when they change, and note ids (random).

Turning it on syncs once, uploads everything again encrypted, and removes the plain copies. Every other device stops syncing until you enter the passphrase there (Settings → Sync). Turning it off does the reverse; other devices stop until it's turned off there too. lines never goes back to plain files on its own, since anyone who can change the bucket could make that happen.

If you forget the passphrase, any device that still syncs can set a new one (Change passphrase…), since it already has the key. With no such device left, the encrypted notes can't be recovered; the copies on each device are unaffected.

With encryption on, the bucket no longer holds Markdown other apps can open; Settings → Export and Import → Export still makes a .zip of plain files, each in its note's format.

## Locked notes

A locked note (Lock Note, in its toolbar or menu) is encrypted on its own, whether end-to-end encryption is on or not. Its file keeps the usual front matter, plus a `locked` line, and its Markdown is encrypted:

```markdown
---
id: 6f1c2a9e-…
created: 2026-10-28T14:43:00.000Z
updated: 2026-10-28T15:02:11.000Z
pinned: false
trashed: false
locked: {"title":"Bank","files":[],"key":{"id":"…","changed":…,"kdf":"PBKDF2-SHA256","iterations":600000,"salt":"…","key":"…"}}
---
AWeRtq…
```

- The Markdown is encrypted with AES-256-GCM under a random key that notes locked with the same password share. Each note carries that key, locked with the password (PBKDF2-SHA-256, 600,000 iterations), so it opens on any device where you type the password. A device that has no password of its own yet takes this one once it's typed.
- Changing the password locks the same key again, in every note that has it; they sync, and the new password opens them everywhere. "Forgot password" sets a new one for notes you lock from then on; notes already locked still need the old one.
- Readable: the title, dates, pin and icon, and the names of the images and files it shows. Those images and files themselves aren't encrypted by the lock (end-to-end encryption does encrypt them).

## Setting up a bucket

1. Create a bucket (private, no public access needed).
2. Create an access key that can only read and write that bucket.
3. In lines, open the sync button at the bottom of the sidebar, choose your provider, and enter the endpoint, bucket and keys.
4. **Only for the web app:** add a CORS rule (below). The desktop and mobile apps send requests from native code and don't need CORS.

### Cloudflare R2

- **Endpoint:** `https://<account-id>.r2.cloudflarestorage.com` (shown in the bucket's settings)
- **Keys:** R2 → *Manage API tokens* → *Create API token* → *Object Read & Write*, scoped to your bucket
- **Region:** `auto` (filled in for you)

### Backblaze B2

- **Endpoint:** shown on the bucket page, e.g. `https://s3.us-west-004.backblazeb2.com`
- **Keys:** *Application Keys* → *Add a New Application Key* with *Read and Write* access to your bucket
- **Region:** taken from the endpoint automatically

### Amazon S3

- **Endpoint:** `https://s3.<region>.amazonaws.com`
- **Keys:** an IAM user with a policy like:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::my-notes" },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::my-notes/*"
    }
  ]
}
```

## CORS (web app only)

Browsers only let a web page call your bucket if the bucket allows the page's origin. Replace the origin with wherever you host lines, e.g. `https://notes.example.com`.

**Amazon S3, Cloudflare R2, MinIO, and most others** (bucket → CORS settings):

```json
[
  {
    "AllowedOrigins": ["https://notes.example.com"],
    "AllowedMethods": ["GET", "PUT", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Backblaze B2** uses its own rule format. Its web UI only offers download-only rules, so set the rule with the [B2 CLI](https://www.backblaze.com/docs/cloud-storage-command-line-tools):

```json
[
  {
    "corsRuleName": "lines",
    "allowedOrigins": ["https://notes.example.com"],
    "allowedOperations": ["s3_get", "s3_head", "s3_put", "s3_delete"],
    "allowedHeaders": ["*"],
    "exposeHeaders": ["ETag"],
    "maxAgeSeconds": 3600
  }
]
```

`ExposeHeaders: ETag` is recommended. Without it sync still works, but it downloads a little more than necessary. A rule that lists the headers it allows, rather than `*`, needs `If-Match` and `If-None-Match` among them.

## Security notes

- Credentials are stored on the device: in the browser's local storage for the web app, and in the app's data folder for native apps. Use a key limited to a single bucket, and revoke it if a device is lost.
- Without end-to-end encryption (above), notes are stored in your bucket unencrypted, protected by your provider's access controls.
- The app lock (Settings → Privacy) encrypts what's on the device too: notes, attachments, and these credentials.
- Locking a note replaces its plain copy in the bucket with the encrypted one. A bucket that keeps old versions (S3 versioning, a drive's file history) may still hold the plain one from before.
