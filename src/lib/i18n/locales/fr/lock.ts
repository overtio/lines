import type { Translation } from "../../format";
import type en from "../en/lock";

export default {
  "lock.form.passphrase": "Phrase secrète",
  "lock.form.password": "Mot de passe",
  "lock.form.currentPassphrase": "Phrase secrète actuelle",
  "lock.form.currentPassword": "Mot de passe actuel",
  "lock.form.newPassphrase": "Nouvelle phrase secrète",
  "lock.form.newPassword": "Nouveau mot de passe",
  "lock.form.again": "Confirmation",
  "lock.form.tooShort": "Utilisez au moins {count} caractères. Quelques mots dont vous vous souviendrez font très bien l’affaire.",
  "lock.form.passphrasesDiffer": "Les deux phrases secrètes ne correspondent pas.",
  "lock.form.passwordsDiffer": "Les deux mots de passe ne correspondent pas.",
  "lock.cancel": "Annuler",

  "lock.app.title": "Verrouillage de l’app",
  "lock.app.intro":
    "Verrouillez lines avec une phrase secrète. Vos notes, pièces jointes et réglages de synchronisation sur cet appareil sont chiffrés, et lines demande la phrase secrète à son ouverture.",
  "lock.app.setUp": "Configurer le verrouillage de l’app…",
  "lock.app.turnOn": "Activer le verrouillage de l’app",
  "lock.app.encrypting": "Chiffrement des notes…",
  "lock.app.turnedOn": "Le verrouillage de l’app est activé. lines demandera la phrase secrète à son ouverture.",
  "lock.app.forget":
    "Si vous l’oubliez, les notes de cet appareil ne pourront pas être ouvertes, pas même par lines. Les notes synchronisées restent en sécurité dans votre stockage de synchronisation.",
  "lock.app.on": "Les notes de cet appareil sont chiffrées, et lines demande votre phrase secrète à son ouverture.",
  "lock.app.after": "Verrouiller après",
  "lock.app.afterLabel": "Verrouiller après cette durée d’inactivité",
  "lock.app.never": "Jamais",
  "lock.app.minutes": "{count} min",
  "lock.app.hour": "1 heure",
  "lock.app.afterHint": "Après cette durée d’inactivité, lines se verrouille tout seul.",
  "lock.app.neverHint": "lines se verrouille lorsque vous le quittez, ou lorsque vous le verrouillez.",
  "lock.app.askTurnOff": "Désactiver…",
  "lock.app.askChange": "Changer la phrase secrète…",
  "lock.app.change": "Changer la phrase secrète",
  "lock.app.changed": "Phrase secrète modifiée.",
  "lock.app.turnOffHint": "Vos notes seront stockées sur cet appareil sans chiffrement, comme avant.",
  "lock.app.turnOff": "Désactiver le verrouillage de l’app",
  "lock.app.decrypting": "Déchiffrement des notes…",
  "lock.app.turnedOff": "Le verrouillage de l’app est désactivé.",
  "lock.lockNow": "Verrouiller maintenant",
  "lock.lockShortcut": "Verrouiller ({shortcut})",
  "lock.changing": "Modification…",
  "lock.unlockWithTouchId": "Déverrouiller avec Touch ID",
  "lock.useTouchId": "Utiliser Touch ID",
  "lock.touchId.turnOnFailed": "Impossible d’activer Touch ID : {error}",
  "lock.touchId.turnOffFailed": "Impossible de désactiver Touch ID : {error}",
  "lock.touchId.failed": "Touch ID n’a pas fonctionné : {error}",

  "lock.notes.title": "Notes verrouillées",
  "lock.notes.intro":
    "Verrouillez une note pour masquer son contenu jusqu’à ce que vous saisissiez un mot de passe : choisissez Verrouiller la note dans son menu, ou le cadenas de sa barre d’outils. La première fois, vous choisissez le mot de passe.",
  "lock.notes.introHint":
    "Une note verrouillée est chiffrée, ici et partout où elle est synchronisée. Son titre reste lisible, pour que la liste puisse l’afficher.",
  "lock.notes.open":
    "Les notes verrouillées sont ouvertes. Elles se verrouillent de nouveau après {minutes, plural, one {# minute} other {# minutes}} d’inactivité, ou lorsque vous les verrouillez.",
  "lock.notes.withPassword": "Les notes verrouillées s’ouvrent avec votre mot de passe.",
  "lock.notes.withPasswordOrTouchId": "Les notes verrouillées s’ouvrent avec votre mot de passe ou Touch ID.",
  "lock.notes.fromOtherDevices":
    "Les notes verrouillées sur vos autres appareils s’ouvrent avec le mot de passe que vous y avez choisi.",
  "lock.notes.touchId": "Ouvrir les notes verrouillées avec Touch ID",
  "lock.notes.askForgot": "Mot de passe oublié…",
  "lock.notes.askChange": "Changer le mot de passe…",
  "lock.notes.changeHint":
    "Toutes les notes verrouillées avec le mot de passe actuel s’ouvriront avec le nouveau, sur tous vos appareils.",
  "lock.notes.change": "Changer le mot de passe",
  "lock.notes.changed": "Mot de passe modifié.",
  "lock.notes.resetHint":
    "Choisissez un nouveau mot de passe pour les notes que vous verrouillerez désormais. Les notes déjà verrouillées ne s’ouvrent qu’avec l’ancien : gardez-les verrouillées jusqu’à ce que vous vous en souveniez.",
  "lock.notes.reset": "Définir le nouveau mot de passe",
  "lock.notes.resetting": "Définition…",
  "lock.notes.wasReset": "Nouveau mot de passe défini. Les notes que vous verrouillerez désormais l’utiliseront.",
  "lock.notes.touchIdHint": "Saisissez le mot de passe des notes verrouillées pour permettre à Touch ID de les ouvrir.",
  "lock.notes.turningOn": "Activation…",
  "lock.notes.notOpen": "Ouvrez d’abord vos notes verrouillées.",

  "lock.synced.title": "Notes synchronisées",
  "lock.synced.intro":
    "Pour chiffrer les notes avant qu’elles ne quittent cet appareil, afin que votre fournisseur de stockage ne puisse pas les lire, activez le chiffrement de bout en bout dans Synchronisation et données.",
  "lock.synced.open": "Ouvrir Synchronisation et données",

  "lock.screen.title": "lines est verrouillé",
  "lock.screen.hint": "Saisissez votre phrase secrète pour ouvrir vos notes.",
  "lock.screen.unlock": "Déverrouiller",
  "lock.screen.unlocking": "Déverrouillage…",
  "lock.screen.unlockFailed": "Impossible de déverrouiller : {error}",
  "lock.screen.forgot": "Phrase secrète oubliée ?",
  "lock.screen.forgotHint":
    "Sans elle, les notes de cet appareil ne peuvent pas être ouvertes, pas même par lines. Si vous synchronisez, vos notes se trouvent toujours dans votre stockage de synchronisation : effacez cet appareil, puis reconnectez la synchronisation.",
  "lock.screen.askErase": "Effacer cet appareil…",
  "lock.screen.eraseQuestion":
    "Effacer toutes les notes et pièces jointes de cet appareil, ainsi que ses réglages de synchronisation ? Les notes synchronisées restent dans votre stockage de synchronisation. Cette action est irréversible.",
  "lock.screen.erase": "Effacer",

  "lock.floating.title": "Verrouillé",
  "lock.floating.unlock": "Déverrouiller…",

  "lock.note.untitled": "Sans titre",
  "lock.note.hint": "Cette note est verrouillée. Saisissez le mot de passe des notes verrouillées pour l’afficher.",
  "lock.note.passwordLabel": "Mot de passe des notes verrouillées",
  "lock.note.view": "Afficher la note",
  "lock.note.opening": "Ouverture…",
  "lock.note.forgot": "Mot de passe oublié ?",
  "lock.note.forgotHint":
    "Sans son mot de passe, une note verrouillée ne peut pas être ouverte, pas même par lines. Vous pouvez définir un nouveau mot de passe pour les notes que vous verrouillerez désormais.",
  "lock.note.openPrivacy": "Ouvrir les réglages de confidentialité",

  "lock.dialog.setTitle": "Définissez un mot de passe pour les notes verrouillées",
  "lock.dialog.setIntro":
    "Il ouvre toutes les notes que vous verrouillez, ici et sur vos autres appareils. Les titres des notes verrouillées restent visibles dans la liste.",
  "lock.dialog.setHint": "Si vous l’oubliez, les notes verrouillées avec ce mot de passe ne pourront pas être ouvertes, pas même par lines.",
  "lock.dialog.openTitle": "Saisissez le mot de passe des notes verrouillées",
  "lock.dialog.openIntro": "Vos notes verrouillées s’ouvrent aussi, jusqu’à ce que vous les verrouilliez de nouveau.",
  "lock.dialog.lockNote": "Verrouiller la note",
  "lock.dialog.locking": "Verrouillage…",

  "lock.error.wrongPassphrase": "Cette phrase secrète est incorrecte.",
  "lock.error.wrongPassword": "Ce mot de passe est incorrect.",
  "lock.error.otherPassword":
    "Ce mot de passe a ouvert d’autres notes verrouillées, mais celle-ci a été verrouillée avec un autre mot de passe.",
  "lock.error.notEncrypted": "Ceci n’a pas été chiffré par lines.",
  "lock.error.unreadable": "Impossible de déchiffrer : le contenu a été modifié, endommagé ou chiffré avec une autre clé.",
  "lock.error.unknownFormat": "Cette clé est dans un format que lines ne connaît pas, peut-être celui d’une version plus récente de lines.",
} satisfies Translation<typeof en>;
