import type { Translation } from "../../format";
import type en from "../en/sync";

export default {
  "sync.intro":
    "Synchronisez vos notes entre vos appareils. Chaque note est enregistrée sous forme de fichier Markdown (ou chiffrée, si vous l’activez plus bas), et vos notes restent aussi sur cet appareil : lines fonctionne donc hors ligne.",
  "sync.syncingWith": "Synchronisation avec {place}…",
  "sync.offline": "Hors ligne. Les modifications seront synchronisées lorsque vous serez de nouveau en ligne.",
  "sync.syncedWith": "Synchronisé avec {place} {date}",
  "sync.connectedTo": "Connecté à {place}",
  "sync.syncNow": "Synchroniser maintenant",
  "sync.method": "Synchroniser avec",
  "sync.method.cloudDrive": "Stockage en ligne",
  "sync.method.folder": "Dossier",
  "sync.method.bucket": "Bucket S3",
  "sync.comingToWeb":
    "Bientôt sur le Web : connectez-vous avec iCloud, Google Drive ou Proton Drive. Dès aujourd’hui, l’app pour Mac peut synchroniser avec chacun d’eux.",

  "sync.spoken.problem": "Problème de synchronisation : {error}",
  "sync.spoken.ready": "La synchronisation est configurée. Vos notes sont synchronisées avec {place}.",

  "sync.connect": "Se connecter",
  "sync.connecting": "Connexion…",
  "sync.connected": "Connecté",
  "sync.disconnect": "Se déconnecter",
  "sync.save": "Enregistrer",
  "sync.cancel": "Annuler",

  "sync.bucket.provider": "Fournisseur de stockage",
  "sync.bucket.endpoint": "Point de terminaison",
  "sync.bucket.bucket": "Bucket",
  "sync.bucket.bucketExample": "mes-notes",
  "sync.bucket.folder": "Dossier",
  "sync.bucket.region": "Région",
  "sync.bucket.accessKeyId": "ID de clé d’accès",
  "sync.bucket.secretAccessKey": "Clé d’accès secrète",
  "sync.bucket.keysApp":
    "Vos clés sont stockées uniquement sur cet appareil. Utilisez une clé qui n’a accès qu’à ce bucket.",
  "sync.bucket.keysBrowser":
    "Vos clés sont stockées uniquement sur cet appareil, dans le stockage de ce navigateur. Utilisez une clé qui n’a accès qu’à ce bucket.",
  "sync.bucket.corsTitle": "Dans le navigateur, le bucket a besoin d’une règle CORS pour {origin}",
  "sync.bucket.corsHelp": "Collez ceci dans les réglages CORS du bucket (S3, R2, MinIO). Pour Backblaze B2, consultez {file}.",
  "sync.bucket.works": "Connecté. lines peut lire et écrire dans ce bucket.",
  "sync.bucket.test": "Tester la connexion",
  "sync.bucket.testing": "Test en cours…",

  "sync.provider.other": "Autre",
  "sync.provider.r2.help": "Dans R2, ouvrez « Manage API tokens » et créez un jeton Object Read & Write pour ce bucket.",
  "sync.provider.b2.help":
    "Dans Application Keys, ajoutez une clé avec un accès en lecture et en écriture à ce bucket. Le point de terminaison figure sur la page du bucket.",
  "sync.provider.s3.help":
    "Utilisez une clé IAM limitée à ce bucket : s3:ListBucket, s3:GetObject, s3:PutObject et s3:DeleteObject.",
  "sync.provider.other.help":
    "Tout stockage compatible S3 : MinIO, Wasabi, Tigris, DigitalOcean Spaces, Garage, Hetzner…",

  "sync.folder.intro":
    "Vos notes sont placées dans un dossier « {folder} » du stockage en ligne, et l’app de ce service les synchronise avec vos autres appareils. Activez-y le même service, puis connectez-y lines.",
  "sync.folder.looking": "Recherche des stockages en ligne…",
  "sync.folder.drives": "Stockage en ligne",
  "sync.folder.none":
    "Aucun stockage en ligne trouvé sur ce Mac. Activez iCloud Drive dans Réglages Système → votre nom → iCloud, ou installez Google Drive, Proton Drive, Dropbox ou OneDrive. Ou utilisez n’importe quel dossier :",
  "sync.folder.chooseOther": "Choisir un autre dossier…",
  "sync.folder.icloud":
    "iCloud Drive garde vos Mac à jour. La synchronisation avec l’app pour iPhone et la connexion avec iCloud sur le Web arrivent bientôt.",
  "sync.folder.showInFinder": "Afficher dans le Finder",
  "sync.folder.show": "Afficher le dossier",
  "sync.folder.switch": "Changer",
  "sync.folder.failed": "Impossible d’utiliser le dossier : {error}",

  "sync.browser.intro":
    "Enregistrez vos notes dans un dossier de cet ordinateur, sous forme de fichiers Markdown que n’importe quelle app peut ouvrir. lines les tient à jour pendant que vous écrivez, et vos notes restent aussi dans ce navigateur.",
  "sync.browser.allow": "Autoriser l’accès",
  "sync.browser.asksAgain": "Votre navigateur redemande l’autorisation après un redémarrage avant que lines puisse utiliser le dossier.",
  "sync.browser.unsupported":
    "Ce navigateur ne peut pas enregistrer dans un dossier. Ouvrez lines dans Chrome ou Edge pour enregistrer vos notes sous forme de fichiers, ou exportez-les depuis Réglages → Données. En attendant, vos notes sont conservées dans ce navigateur.",
  "sync.browser.choose": "Choisir un dossier…",
  "sync.browser.chooseAnother": "Choisir un autre dossier…",
  "sync.browser.cantPick": "Ce navigateur ne peut pas enregistrer dans un dossier. Essayez Chrome ou Edge.",
  "sync.browser.gone": "Le dossier n’est plus disponible. Choisissez-le de nouveau dans Réglages → Synchronisation et données.",
  "sync.browser.permission":
    "lines a besoin de votre autorisation pour utiliser de nouveau « {name} ». Ouvrez Réglages → Synchronisation et données et autorisez-le.",

  "sync.e2e.title": "Chiffrement de bout en bout",
  "sync.e2e.intro":
    "Chiffrez les notes et les pièces jointes sur cet appareil avant leur synchronisation, pour que votre fournisseur de stockage ne puisse pas les lire. Vos autres appareils demandent la phrase secrète une seule fois.",
  "sync.e2e.setUp": "Configurer le chiffrement…",
  "sync.e2e.encrypt": "Chiffrer les notes synchronisées",
  "sync.e2e.encrypting": "Chiffrement…",
  "sync.e2e.encrypted": "Le chiffrement est activé. Vos notes sont de nouveau envoyées, chiffrées.",
  "sync.e2e.forget":
    "Si vous oubliez la phrase secrète, un appareil qui la connaît déjà peut en définir une nouvelle. Le bucket ou le dossier ne contient plus de fichiers Markdown que d’autres apps peuvent ouvrir ; Exporter continue d’en créer.",
  "sync.e2e.on": "Les notes sont chiffrées sur cet appareil avant leur synchronisation. Seuls vos appareils peuvent les lire.",
  "sync.e2e.askTurnOff": "Désactiver…",
  "sync.e2e.askChange": "Changer la phrase secrète…",
  "sync.e2e.changeHint": "Vos autres appareils continuent de se synchroniser. Un nouvel appareil aura besoin de la nouvelle phrase secrète.",
  "sync.e2e.change": "Changer la phrase secrète",
  "sync.e2e.changing": "Modification…",
  "sync.e2e.changed": "Phrase secrète modifiée.",
  "sync.e2e.turnOffHint":
    "Vos notes seront de nouveau envoyées sous forme de fichiers Markdown non chiffrés, lisibles par votre fournisseur de stockage. Les autres appareils cessent de se synchroniser jusqu’à ce que le chiffrement y soit aussi désactivé.",
  "sync.e2e.turnOff": "Désactiver le chiffrement",
  "sync.e2e.turningOff": "Désactivation…",
  "sync.e2e.locked": "Les notes à cet emplacement sont chiffrées. Saisissez la phrase secrète avec laquelle elles ont été chiffrées pour les synchroniser.",
  "sync.e2e.unlock": "Déverrouiller",
  "sync.e2e.unlocking": "Déverrouillage…",
  "sync.e2e.turnedOff":
    "Le chiffrement a été désactivé sur un autre appareil : les notes à cet emplacement sont de nouveau des fichiers Markdown non chiffrés.",
  "sync.e2e.turnOffToo": "Le désactiver ici aussi",

  "sync.error.failed": "Échec de la synchronisation : {error}",
  "sync.error.tooShort": "Utilisez au moins {count} caractères.",
  "sync.error.notEncrypted": "Les notes à cet emplacement ne sont plus chiffrées.",
  "sync.error.changedElsewhere": "Le chiffrement a été modifié sur un autre appareil. Synchronisez, puis réessayez.",
  "sync.error.keyFileMissing":
    "Le fichier de clé des notes ({file}) est introuvable. Si le stockage en ligne est encore en train de le télécharger, cela se réglera tout seul.",
  "sync.error.keyFileDamaged":
    "{file} est endommagé ou provient d’une version plus récente de lines : rien n’a été synchronisé.",
  "sync.error.turnedOff":
    "Le chiffrement a été désactivé sur un autre appareil. Désactivez-le ici aussi pour continuer la synchronisation.",
  "sync.error.rekeyed":
    "Le chiffrement a été reconfiguré sur un autre appareil. Saisissez sa nouvelle phrase secrète pour continuer la synchronisation.",
  "sync.error.encrypted": "Les notes à cet emplacement sont chiffrées. Saisissez la phrase secrète pour les synchroniser.",
  "sync.error.missing":
    "Les notes synchronisées sont absentes de l’emplacement distant : rien n’a été modifié ici. Si vous l’avez vidé volontairement, déconnectez-vous puis reconnectez-vous.",
  "sync.error.undecryptable": "Impossible de déchiffrer {file} : il a été modifié ou chiffré avec une autre clé.",
  "sync.error.notSealed": "{file} n’est pas une note chiffrée.",
  "sync.error.unreachableApp": "Impossible de joindre le point de terminaison de stockage. Vérifiez l’URL et votre connexion.",
  "sync.error.unreachableBrowser":
    "Impossible de joindre le bucket. Vérifiez le point de terminaison, et que les règles CORS du bucket autorisent ce site.",
  "sync.error.wrongKey": "La clé d’accès ou le secret est incorrect.",
  "sync.error.noBucket": "Le bucket « {bucket} » n’existe pas à ce point de terminaison.",
  "sync.error.denied": "Accès refusé. Vérifiez que la clé peut lire et écrire dans ce bucket.",
  "sync.error.service": "Le service de stockage a renvoyé une erreur ({status}) : {message}",
  "sync.error.status": "Le service de stockage a renvoyé {status}.",
  "sync.error.notS3": "Le point de terminaison n’a pas répondu comme un stockage S3. Vérifiez son URL.",

  "sync.conflicted": "{title} (copie en conflit)",
  "sync.conflictedCopy": "Copie en conflit",
  "sync.untitled": "Sans titre",
} satisfies Translation<typeof en>;
