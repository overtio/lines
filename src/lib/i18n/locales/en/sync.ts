/** Sync: cloud drives, folders, buckets, end-to-end encryption, and sync's messages. */
export default {
  /* Settings → Sync & Data. */
  "sync.intro":
    "Sync your notes across devices. Each note is saved as a Markdown file (or encrypted, if you turn that on below), and your notes stay on this device too, so lines works offline.",
  // {place} is the drive or bucket, as in “iCloud Drive” or “my-notes”.
  "sync.syncingWith": "Syncing with {place}…",
  "sync.offline": "Offline. Changes will sync when you’re back online.",
  // {date} is when, as in “today at 10:42”.
  "sync.syncedWith": "Synced with {place} {date}",
  "sync.connectedTo": "Connected to {place}",
  "sync.syncNow": "Sync now",
  // What sync goes through: a cloud drive's folder, or an S3 bucket.
  "sync.method": "Sync with",
  "sync.method.cloudDrive": "Cloud drive",
  "sync.method.folder": "Folder",
  "sync.method.bucket": "S3 bucket",
  "sync.comingToWeb":
    "Coming to the web: sign in with iCloud, Google Drive or Proton Drive. Today, the Mac app can sync through any of them.",

  /* Said by screen readers, when sync changes out of sight. */
  "sync.spoken.problem": "Sync problem: {error}",
  "sync.spoken.ready": "Sync is set up. Your notes are synced with {place}.",

  /* Buttons the forms share. */
  "sync.connect": "Connect",
  "sync.connecting": "Connecting…",
  // A badge beside the drive or folder lines syncs with now.
  "sync.connected": "Connected",
  "sync.disconnect": "Disconnect",
  "sync.save": "Save",
  "sync.cancel": "Cancel",

  /* An S3-compatible bucket. */
  "sync.bucket.provider": "Storage provider",
  "sync.bucket.endpoint": "Endpoint",
  "sync.bucket.bucket": "Bucket",
  // An example bucket name, shown in the empty field.
  "sync.bucket.bucketExample": "my-notes",
  // The folder inside the bucket the notes go in.
  "sync.bucket.folder": "Folder",
  "sync.bucket.region": "Region",
  "sync.bucket.accessKeyId": "Access key ID",
  "sync.bucket.secretAccessKey": "Secret access key",
  "sync.bucket.keysApp": "Your keys are stored only on this device. Use a key that can access just this bucket.",
  "sync.bucket.keysBrowser":
    "Your keys are stored only on this device, in this browser’s storage. Use a key that can access just this bucket.",
  // {origin} is this site's address, shown as code.
  "sync.bucket.corsTitle": "In the browser, the bucket needs a CORS rule for {origin}",
  // {file} is the name of a document, shown as code.
  "sync.bucket.corsHelp": "Paste this into the bucket’s CORS settings (S3, R2, MinIO). For Backblaze B2, see {file}.",
  "sync.bucket.works": "Connected. lines can read and write this bucket.",
  "sync.bucket.test": "Test connection",
  "sync.bucket.testing": "Testing…",

  /* Storage providers' help, under the provider. */
  "sync.provider.other": "Other",
  "sync.provider.r2.help": "In R2, open “Manage API tokens” and create an Object Read & Write token for this bucket.",
  "sync.provider.b2.help":
    "In Application Keys, add a key with Read and Write access to this bucket. The endpoint is shown on the bucket page.",
  "sync.provider.s3.help": "Use an IAM key limited to this bucket: s3:ListBucket, s3:GetObject, s3:PutObject and s3:DeleteObject.",
  "sync.provider.other.help": "Any S3-compatible storage: MinIO, Wasabi, Tigris, DigitalOcean Spaces, Garage, Hetzner…",

  /* A cloud drive's folder (the desktop apps). */
  // {folder} is the folder's name, “lines”.
  "sync.folder.intro":
    "Your notes go in a “{folder}” folder in the drive, and the drive’s app syncs them to your other devices. Turn on the same drive there, and connect lines to it.",
  "sync.folder.looking": "Looking for cloud drives…",
  "sync.folder.drives": "Cloud drive",
  "sync.folder.none":
    "No cloud drives found on this Mac. Turn on iCloud Drive in System Settings → your name → iCloud, or install Google Drive, Proton Drive, Dropbox or OneDrive. Or use any folder:",
  "sync.folder.chooseOther": "Choose another folder…",
  "sync.folder.icloud":
    "iCloud Drive keeps your Macs in step. Syncing with the iPhone app and signing in with iCloud on the web are on the way.",
  "sync.folder.showInFinder": "Show in Finder",
  "sync.folder.show": "Show folder",
  // Connects to the folder chosen in place of the one connected now.
  "sync.folder.switch": "Switch",
  // {error} is what the system said, in English.
  "sync.folder.failed": "Couldn’t use the folder: {error}",

  /* A folder on this computer, from the browser. */
  "sync.browser.intro":
    "Save your notes to a folder on this computer, as Markdown files that any app can open. lines keeps them up to date as you write, and your notes stay in this browser too.",
  "sync.browser.allow": "Allow access",
  "sync.browser.asksAgain": "Your browser asks again after a restart before lines may use the folder.",
  "sync.browser.unsupported":
    "This browser can’t save to a folder. Open lines in Chrome or Edge to save your notes as files, or export them from Settings → Data. Your notes are kept in this browser in the meantime.",
  "sync.browser.choose": "Choose a Folder…",
  "sync.browser.chooseAnother": "Choose Another Folder…",
  "sync.browser.cantPick": "This browser can’t save to a folder. Try Chrome or Edge.",
  "sync.browser.gone": "The folder isn’t available any more. Choose it again in Settings → Sync & Data.",
  // {name} is the folder's name.
  "sync.browser.permission": "lines needs your permission to use “{name}” again. Open Settings → Sync & Data and allow it.",

  /* End-to-end encryption. */
  "sync.e2e.title": "End-to-end encryption",
  "sync.e2e.intro":
    "Encrypt notes and attachments on this device before they’re synced, so your storage provider can’t read them. Your other devices ask for the passphrase once.",
  "sync.e2e.setUp": "Set up encryption…",
  "sync.e2e.encrypt": "Encrypt synced notes",
  "sync.e2e.encrypting": "Encrypting…",
  "sync.e2e.encrypted": "Encryption is on. Your notes are being uploaded again, encrypted.",
  "sync.e2e.forget":
    "If you forget the passphrase, a device that already has it can set a new one. The bucket or folder no longer holds Markdown files other apps can open; Export still makes them.",
  "sync.e2e.on": "Notes are encrypted on this device before they’re synced. Only your devices can read them.",
  "sync.e2e.askTurnOff": "Turn off…",
  "sync.e2e.askChange": "Change passphrase…",
  "sync.e2e.changeHint": "Your other devices keep syncing. A new device will need the new passphrase.",
  "sync.e2e.change": "Change passphrase",
  "sync.e2e.changing": "Changing…",
  "sync.e2e.changed": "Passphrase changed.",
  "sync.e2e.turnOffHint":
    "Your notes will be uploaded again as plain Markdown files that your storage provider can read. Other devices stop syncing until encryption is turned off there too.",
  "sync.e2e.turnOff": "Turn off encryption",
  "sync.e2e.turningOff": "Turning off…",
  "sync.e2e.locked": "The notes there are encrypted. Enter the passphrase they were encrypted with to sync them.",
  "sync.e2e.unlock": "Unlock",
  "sync.e2e.unlocking": "Unlocking…",
  "sync.e2e.turnedOff": "Encryption was turned off on another device, so the notes there are plain Markdown files again.",
  "sync.e2e.turnOffToo": "Turn off here too",

  /* Problems, shown in Settings → Sync & Data and spoken. */
  // {error} is what went wrong, often in English.
  "sync.error.failed": "Sync failed: {error}",
  "sync.error.tooShort": "Use at least {count} characters.",
  "sync.error.notEncrypted": "The notes there aren’t encrypted any more.",
  "sync.error.changedElsewhere": "Encryption was changed on another device. Sync, then try again.",
  // {file} is the key file's name, encryption.json.
  "sync.error.keyFileMissing": "The notes’ key file ({file}) is missing. If the drive is still downloading it, this clears up by itself.",
  "sync.error.keyFileDamaged": "{file} is damaged or from a newer version of lines, so nothing was synced.",
  "sync.error.turnedOff": "Encryption was turned off on another device. Turn it off here too to keep syncing.",
  "sync.error.rekeyed": "Encryption was set up again on another device. Enter its new passphrase to keep syncing.",
  "sync.error.encrypted": "The notes there are encrypted. Enter the passphrase to sync them.",
  "sync.error.missing":
    "The synced notes are missing from the remote, so nothing was changed here. If you cleared it on purpose, disconnect and connect again.",
  // {file} is a synced file's path, as in notes/<id>.md.
  "sync.error.undecryptable": "{file} couldn’t be decrypted: it was changed, or encrypted with another key.",
  "sync.error.notSealed": "{file} isn’t an encrypted note.",
  "sync.error.unreachableApp": "Couldn’t reach the storage endpoint. Check the URL and your connection.",
  "sync.error.unreachableBrowser": "Couldn’t reach the bucket. Check the endpoint, and that the bucket’s CORS rules allow this site.",
  "sync.error.wrongKey": "The access key or secret is wrong.",
  "sync.error.noBucket": "Bucket “{bucket}” doesn’t exist at this endpoint.",
  "sync.error.denied": "Access denied. Make sure the key can read and write this bucket.",
  // {status} is the HTTP status code, as in 500; {message} is the service's own words, in English.
  "sync.error.service": "The storage service returned an error ({status}): {message}",
  "sync.error.status": "The storage service returned {status}.",
  "sync.error.notS3": "The endpoint didn’t answer like S3 storage. Check the endpoint URL.",

  /* When a note was edited on two devices, the older edit is kept as a copy. */
  // {title} is the note's first line, or its title.
  "sync.conflicted": "{title} (conflicted copy)",
  // A conflicted copy of a note with nothing in it yet.
  "sync.conflictedCopy": "Conflicted copy",
  "sync.untitled": "Untitled",
};
