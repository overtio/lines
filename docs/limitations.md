# Known limitations and future work: encryption, app lock, locked notes

What these features don't do (yet), and what hasn't been tried outside tests. The planned work is also on the [roadmap](../README.md#roadmap). How they work is in [sync.md](sync.md).

## Not tried on real devices yet

Each of these has only run in Chrome, through the end-to-end tests (two browser profiles and a stand-in S3 server):

- [ ] **Touch ID** in the Mac app, for the app lock and for locked notes. The development build is unsigned, so macOS may ask for the login password the first time lines reads its Keychain item ("lines app lock").
- [ ] **Floating notes** while lines is locked, and while locked notes are locked or open. The key is handed to them through the app's native side (app lock) or the window channel (locked notes).
- [ ] **End-to-end encryption with a cloud drive folder.** Only S3 was tested end to end with encryption on. Plain folder sync passes its test.
- [ ] **iPhone and Android.** None of the three features has been run there.
- [ ] **Saving to a folder on the web** with a folder picked in the real folder picker, and the "Allow access" prompt after restarting the browser. The tests used the browser's private storage, which has the same interface but never asks.

## Saving to a folder on the web

- Only Chrome, Edge and other Chromium browsers have the File System Access API. Safari and Firefox keep notes in the browser, and can export them.
- After the browser restarts, it asks again before lines may use the folder; until someone clicks Allow access in Settings → Sync & Data, sync shows an error.
- The browser blocks some folders (the home folder itself, system folders, Downloads on some systems).

## End-to-end encryption (sync)

- Still visible to the storage provider: how many notes and attachments there are, their sizes, when they change, and note ids (random).
- If every device that has the key is lost and the passphrase is forgotten, the encrypted notes in the bucket can't be recovered.
- With encryption on, the bucket no longer holds Markdown that other apps can open. Export still makes plain Markdown.

## App lock

- Turning it on rewrites notes encrypted, but earlier plain copies can linger in the database's free pages or write-ahead log until they're overwritten. FileVault (or the phone's own encryption) covers this.
- Opening an attachment in the native apps writes a readable copy to the app's cache folder, and it stays there.
- Attachments are encrypted on the device, but their ids (content hashes) aren't.
- On the web, each tab unlocks on its own.
- There's no Face ID on iPhone yet; the passphrase works there.
- A forgotten passphrase means erasing the device. Synced notes come back from sync storage.

## Locked notes

- **Images and files in a locked note aren't encrypted by the lock.** Their names are listed, readable, in the note (so they're kept and synced while it's locked). Sync encryption does encrypt them. Planned.
- Readable even while locked: the title, dates, pin, icon, and the attachment names above.
- A locked note's tags, to-dos and text are left out of tags, Todo and search, even while it's open. Only its title is searchable.
- Locking a note replaces its plain copy in the bucket or drive. A bucket with versioning, or a drive's file history, may still hold the plain version from before.
- Old plain copies can linger on the device's disk, as with the app lock above.
- They lock again after a fixed 5 minutes without use. That's not a setting yet, and each window counts its own idle time (locking by hand locks every window).
- A forgotten password can't be recovered. "Forgot password" only sets a new one for notes locked from then on; notes already locked keep needing the old one.
- A password changed on one device reaches another device's notes when those notes sync from the first. A note locked only on the second device keeps the old wrapping, which the old password still opens, until it's locked or edited again there.
- There's no password hint.
- Notes locked with different passwords (after "Forgot password", or on two devices before they synced) stay separate. Typing a password opens every note it fits.
- Conflict copies of a locked note that isn't open get "(conflicted copy)" in their visible title only.
- Face ID on iPhone isn't done.

## Future work

- [ ] Encrypt images and files in locked notes
- [ ] Face ID for the app lock and locked notes on iPhone
- [ ] A setting for how long locked notes stay open
- [ ] Optional password hint for locked notes
- [ ] Clear opened attachment copies from the cache when lines locks or quits
- [ ] Store sync credentials in the OS keychain on native platforms
- [ ] Remove attachments from sync storage once no note uses them
