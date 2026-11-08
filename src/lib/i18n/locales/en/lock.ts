/** The app lock and locked notes: passwords, Touch ID, the lock screen. */
export default {
  /* Asking for a passphrase (the app lock, encrypted sync) or a password (locked notes). */
  "lock.form.passphrase": "Passphrase",
  "lock.form.password": "Password",
  "lock.form.currentPassphrase": "Current passphrase",
  "lock.form.currentPassword": "Current password",
  "lock.form.newPassphrase": "New passphrase",
  "lock.form.newPassword": "New password",
  // The same passphrase or password, a second time.
  "lock.form.again": "Type it again",
  "lock.form.tooShort": "Use at least {count} characters. A few words you’ll remember work well.",
  "lock.form.passphrasesDiffer": "The two passphrases don’t match.",
  "lock.form.passwordsDiffer": "The two passwords don’t match.",
  "lock.cancel": "Cancel",

  /* Settings → Privacy: the app lock. */
  "lock.app.title": "App lock",
  "lock.app.intro":
    "Lock lines with a passphrase. Your notes, attachments and sync settings on this device are encrypted, and lines asks for the passphrase when it opens.",
  "lock.app.setUp": "Set up app lock…",
  "lock.app.turnOn": "Turn on app lock",
  "lock.app.encrypting": "Encrypting notes…",
  "lock.app.turnedOn": "App lock is on. lines will ask for the passphrase when it opens.",
  "lock.app.forget":
    "If you forget it, the notes on this device can’t be opened, not even by lines. Synced notes stay safe in your sync storage.",
  "lock.app.on": "Notes on this device are encrypted, and lines asks for your passphrase when it opens.",
  "lock.app.after": "Lock after",
  "lock.app.afterLabel": "Lock after this long without use",
  "lock.app.never": "Never",
  // Short, to fit a segmented control: “5 min”.
  "lock.app.minutes": "{count} min",
  "lock.app.hour": "1 hour",
  "lock.app.afterHint": "Without use for that long, lines locks itself.",
  "lock.app.neverHint": "lines locks when it quits, or when you lock it.",
  "lock.app.askTurnOff": "Turn off…",
  "lock.app.askChange": "Change passphrase…",
  "lock.app.change": "Change passphrase",
  "lock.app.changed": "Passphrase changed.",
  "lock.app.turnOffHint": "Your notes will be stored on this device without encryption, as before.",
  "lock.app.turnOff": "Turn off app lock",
  "lock.app.decrypting": "Decrypting notes…",
  "lock.app.turnedOff": "App lock is off.",
  "lock.lockNow": "Lock now",
  // The tooltip: {shortcut} is the keyboard shortcut, as in ⌃⌘L.
  "lock.lockShortcut": "Lock ({shortcut})",
  "lock.changing": "Changing…",
  "lock.unlockWithTouchId": "Unlock with Touch ID",
  "lock.useTouchId": "Use Touch ID",
  // {error} is what the system said, often in English.
  "lock.touchId.turnOnFailed": "Couldn’t turn on Touch ID: {error}",
  "lock.touchId.turnOffFailed": "Couldn’t turn off Touch ID: {error}",
  "lock.touchId.failed": "Touch ID didn’t work: {error}",

  /* Settings → Privacy: locked notes. */
  "lock.notes.title": "Locked notes",
  // “Lock Note” is the note menu's item.
  "lock.notes.intro":
    "Lock a note to keep what it says out of sight until you enter a password: choose Lock Note from its menu, or the lock in its toolbar. The first time, you choose the password.",
  "lock.notes.introHint": "A locked note is encrypted, here and wherever it syncs to. Its title stays readable, so the list can show it.",
  "lock.notes.open":
    "Locked notes are open. They lock again after {minutes, plural, one {# minute} other {# minutes}} without use, or when you lock them.",
  "lock.notes.withPassword": "Locked notes open with your password.",
  "lock.notes.withPasswordOrTouchId": "Locked notes open with your password or Touch ID.",
  "lock.notes.fromOtherDevices": "Notes locked on your other devices open with the password you chose there.",
  "lock.notes.touchId": "Open locked notes with Touch ID",
  "lock.notes.askForgot": "Forgot password…",
  "lock.notes.askChange": "Change password…",
  "lock.notes.changeHint": "Every note locked with the current password opens with the new one, on all your devices.",
  "lock.notes.change": "Change password",
  "lock.notes.changed": "Password changed.",
  "lock.notes.resetHint":
    "Choose a new password for the notes you lock from now on. Notes already locked still open only with the old one, so keep them locked until you remember it.",
  "lock.notes.reset": "Set new password",
  "lock.notes.resetting": "Setting…",
  "lock.notes.wasReset": "New password set. Notes you lock from now on use it.",
  "lock.notes.touchIdHint": "Enter the password for locked notes to let Touch ID open them.",
  "lock.notes.turningOn": "Turning on…",
  "lock.notes.notOpen": "Open your locked notes first.",

  /* Settings → Privacy: synced notes. */
  "lock.synced.title": "Synced notes",
  "lock.synced.intro":
    "To encrypt notes before they leave this device, so your storage provider can’t read them, turn on end-to-end encryption in Settings → Sync.",
  "lock.synced.open": "Go to Sync",

  /* The lock screen, while lines is locked. */
  "lock.screen.title": "lines is locked",
  "lock.screen.hint": "Enter your passphrase to open your notes.",
  "lock.screen.unlock": "Unlock",
  "lock.screen.unlocking": "Unlocking…",
  "lock.screen.unlockFailed": "Couldn’t unlock: {error}",
  "lock.screen.forgot": "Forgot your passphrase?",
  "lock.screen.forgotHint":
    "Without it, the notes on this device can’t be opened, not even by lines. If you sync, your notes are still in your sync storage: erase this device, then connect sync again.",
  "lock.screen.askErase": "Erase this device…",
  "lock.screen.eraseQuestion":
    "Erase every note and attachment on this device, and its sync settings? Notes that were synced stay in your sync storage. This can’t be undone.",
  "lock.screen.erase": "Erase",

  /* A floating note's window while lines is locked. */
  // The window's title.
  "lock.floating.title": "Locked",
  "lock.floating.unlock": "Unlock…",

  /* A locked note, in place of the editor. */
  "lock.note.untitled": "Untitled",
  "lock.note.hint": "This note is locked. Enter the password for locked notes to view it.",
  "lock.note.passwordLabel": "Password for locked notes",
  "lock.note.view": "View note",
  "lock.note.opening": "Opening…",
  "lock.note.forgot": "Forgot the password?",
  "lock.note.forgotHint":
    "Without its password, a locked note can’t be opened, not even by lines. You can set a new password for the notes you lock from now on.",
  "lock.note.openPrivacy": "Open Privacy settings",

  /* The dialog that asks for the locked notes' password before a note is locked. */
  "lock.dialog.setTitle": "Set a password for locked notes",
  "lock.dialog.setIntro": "It opens every note you lock, here and on your other devices. Locked notes’ titles still show in the list.",
  "lock.dialog.setHint": "If you forget it, the notes you lock with it can’t be opened, not even by lines.",
  "lock.dialog.openTitle": "Enter the password for locked notes",
  "lock.dialog.openIntro": "Your locked notes open too, until you lock them again.",
  "lock.dialog.secretIntro": "Your secrets are kept in a locked note. Your other locked notes open too, until you lock them again.",
  "lock.dialog.open": "Open",
  "lock.dialog.opening": "Opening…",
  "lock.dialog.lockNote": "Lock Note",
  "lock.dialog.locking": "Locking…",

  /* Wrong passwords, and what can't be decrypted. */
  "lock.error.wrongPassphrase": "That passphrase isn’t right.",
  "lock.error.wrongPassword": "That password isn’t right.",
  "lock.error.otherPassword": "That opened other locked notes, but this one was locked with a different password.",
  "lock.error.notEncrypted": "This wasn’t encrypted by lines.",
  "lock.error.unreadable": "This couldn’t be decrypted: it was changed, damaged, or encrypted with another key.",
  "lock.error.unknownFormat": "This key is in a format lines doesn’t know, perhaps from a newer version of lines.",
};
