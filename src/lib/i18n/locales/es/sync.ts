import type { Translation } from "../../format";
import type en from "../en/sync";

export default {
  "sync.intro":
    "Sincroniza tus notas entre dispositivos. Cada nota se guarda como un archivo Markdown (o cifrada, si lo activas más abajo), y tus notas también se quedan en este dispositivo, así que lines funciona sin conexión.",
  "sync.syncingWith": "Sincronizando con {place}…",
  "sync.offline": "Sin conexión. Los cambios se sincronizarán cuando vuelvas a estar en línea.",
  "sync.syncedWith": "Sincronizado con {place} {date}",
  "sync.connectedTo": "Conectado a {place}",
  "sync.syncNow": "Sincronizar ahora",
  "sync.method": "Sincronizar con",
  "sync.method.cloudDrive": "Unidad en la nube",
  "sync.method.folder": "Carpeta",
  "sync.method.bucket": "Bucket S3",
  "sync.comingToWeb":
    "Muy pronto en la web: inicia sesión con iCloud, Google Drive o Proton Drive. Hoy, la app para Mac puede sincronizar a través de cualquiera de ellos.",

  "sync.spoken.problem": "Problema de sincronización: {error}",
  "sync.spoken.ready": "La sincronización está configurada. Tus notas se sincronizan con {place}.",

  "sync.connect": "Conectar",
  "sync.connecting": "Conectando…",
  "sync.connected": "Conectado",
  "sync.disconnect": "Desconectar",
  "sync.save": "Guardar",
  "sync.cancel": "Cancelar",

  "sync.bucket.provider": "Proveedor de almacenamiento",
  "sync.bucket.endpoint": "Endpoint",
  "sync.bucket.bucket": "Bucket",
  "sync.bucket.bucketExample": "mis-notas",
  "sync.bucket.folder": "Carpeta",
  "sync.bucket.region": "Región",
  "sync.bucket.accessKeyId": "ID de clave de acceso",
  "sync.bucket.secretAccessKey": "Clave de acceso secreta",
  "sync.bucket.keysApp": "Tus claves solo se guardan en este dispositivo. Usa una clave que solo pueda acceder a este bucket.",
  "sync.bucket.keysBrowser":
    "Tus claves solo se guardan en este dispositivo, en el almacenamiento de este navegador. Usa una clave que solo pueda acceder a este bucket.",
  "sync.bucket.corsTitle": "En el navegador, el bucket necesita una regla CORS para {origin}",
  "sync.bucket.corsHelp": "Pega esto en los ajustes CORS del bucket (S3, R2, MinIO). Para Backblaze B2, consulta {file}.",
  "sync.bucket.works": "Conectado. lines puede leer y escribir en este bucket.",
  "sync.bucket.test": "Probar la conexión",
  "sync.bucket.testing": "Probando…",

  "sync.provider.other": "Otro",
  "sync.provider.r2.help": "En R2, abre “Manage API tokens” y crea un token Object Read & Write para este bucket.",
  "sync.provider.b2.help":
    "En Application Keys, añade una clave con acceso de lectura y escritura a este bucket. El endpoint aparece en la página del bucket.",
  "sync.provider.s3.help":
    "Usa una clave de IAM limitada a este bucket: s3:ListBucket, s3:GetObject, s3:PutObject y s3:DeleteObject.",
  "sync.provider.other.help":
    "Cualquier almacenamiento compatible con S3: MinIO, Wasabi, Tigris, DigitalOcean Spaces, Garage, Hetzner…",

  "sync.folder.intro":
    "Tus notas van a una carpeta “{folder}” en la unidad, y la app de la unidad las sincroniza con tus otros dispositivos. Activa allí la misma unidad y conecta lines a ella.",
  "sync.folder.looking": "Buscando unidades en la nube…",
  "sync.folder.drives": "Unidad en la nube",
  "sync.folder.none":
    "No se han encontrado unidades en la nube en este Mac. Activa iCloud Drive en Ajustes del Sistema → tu nombre → iCloud, o instala Google Drive, Proton Drive, Dropbox u OneDrive. O usa cualquier carpeta:",
  "sync.folder.chooseOther": "Elegir otra carpeta…",
  "sync.folder.icloud":
    "iCloud Drive mantiene tus Mac al día. La sincronización con la app para iPhone y el inicio de sesión con iCloud en la web están en camino.",
  "sync.folder.showInFinder": "Mostrar en el Finder",
  "sync.folder.show": "Mostrar la carpeta",
  "sync.folder.switch": "Cambiar",
  "sync.folder.failed": "No se ha podido usar la carpeta: {error}",

  "sync.browser.intro":
    "Guarda tus notas en una carpeta de este ordenador, como archivos Markdown que cualquier app puede abrir. lines las mantiene al día mientras escribes, y tus notas también se quedan en este navegador.",
  "sync.browser.allow": "Permitir el acceso",
  "sync.browser.asksAgain": "Tu navegador vuelve a preguntar tras reiniciarse antes de que lines pueda usar la carpeta.",
  "sync.browser.unsupported":
    "Este navegador no puede guardar en una carpeta. Abre lines en Chrome o Edge para guardar tus notas como archivos, o expórtalas desde Ajustes → Datos. Mientras tanto, tus notas se guardan en este navegador.",
  "sync.browser.choose": "Elegir una carpeta…",
  "sync.browser.chooseAnother": "Elegir otra carpeta…",
  "sync.browser.cantPick": "Este navegador no puede guardar en una carpeta. Prueba con Chrome o Edge.",
  "sync.browser.gone": "La carpeta ya no está disponible. Vuelve a elegirla en Ajustes → Datos.",
  "sync.browser.permission":
    "lines necesita tu permiso para volver a usar “{name}”. Abre Ajustes → Datos y permítelo.",

  "sync.e2e.title": "Cifrado de extremo a extremo",
  "sync.e2e.intro":
    "Cifra las notas y los archivos adjuntos en este dispositivo antes de sincronizarlos, para que tu proveedor de almacenamiento no pueda leerlos. Tus otros dispositivos te piden la frase de contraseña una vez.",
  "sync.e2e.setUp": "Configurar el cifrado…",
  "sync.e2e.encrypt": "Cifrar las notas sincronizadas",
  "sync.e2e.encrypting": "Cifrando…",
  "sync.e2e.encrypted": "El cifrado está activado. Tus notas se están volviendo a subir, cifradas.",
  "sync.e2e.forget":
    "Si olvidas la frase de contraseña, un dispositivo que ya la tenga puede establecer una nueva. El bucket o la carpeta ya no contiene archivos Markdown que otras apps puedan abrir; Exportar sigue creándolos.",
  "sync.e2e.on": "Las notas se cifran en este dispositivo antes de sincronizarse. Solo tus dispositivos pueden leerlas.",
  "sync.e2e.askTurnOff": "Desactivar…",
  "sync.e2e.askChange": "Cambiar la frase de contraseña…",
  "sync.e2e.changeHint": "Tus otros dispositivos siguen sincronizando. Un dispositivo nuevo necesitará la nueva frase de contraseña.",
  "sync.e2e.change": "Cambiar la frase de contraseña",
  "sync.e2e.changing": "Cambiando…",
  "sync.e2e.changed": "Frase de contraseña cambiada.",
  "sync.e2e.turnOffHint":
    "Tus notas se volverán a subir como archivos Markdown sin cifrar que tu proveedor de almacenamiento puede leer. Los demás dispositivos dejan de sincronizar hasta que también se desactive el cifrado en ellos.",
  "sync.e2e.turnOff": "Desactivar el cifrado",
  "sync.e2e.turningOff": "Desactivando…",
  "sync.e2e.locked": "Las notas de allí están cifradas. Introduce la frase de contraseña con la que se cifraron para sincronizarlas.",
  "sync.e2e.unlock": "Desbloquear",
  "sync.e2e.unlocking": "Desbloqueando…",
  "sync.e2e.turnedOff":
    "El cifrado se desactivó en otro dispositivo, así que las notas de allí vuelven a ser archivos Markdown sin cifrar.",
  "sync.e2e.turnOffToo": "Desactivarlo también aquí",

  "sync.error.failed": "La sincronización ha fallado: {error}",
  "sync.error.tooShort": "Usa al menos {count} caracteres.",
  "sync.error.notEncrypted": "Las notas de allí ya no están cifradas.",
  "sync.error.changedElsewhere": "El cifrado se cambió en otro dispositivo. Sincroniza y vuelve a intentarlo.",
  "sync.error.keyFileMissing":
    "Falta el archivo de clave de las notas ({file}). Si la unidad aún lo está descargando, se resolverá solo.",
  "sync.error.keyFileDamaged": "{file} está dañado o es de una versión más reciente de lines, así que no se ha sincronizado nada.",
  "sync.error.turnedOff": "El cifrado se desactivó en otro dispositivo. Desactívalo también aquí para seguir sincronizando.",
  "sync.error.rekeyed":
    "El cifrado se volvió a configurar en otro dispositivo. Introduce su nueva frase de contraseña para seguir sincronizando.",
  "sync.error.encrypted": "Las notas de allí están cifradas. Introduce la frase de contraseña para sincronizarlas.",
  "sync.error.missing":
    "Las notas sincronizadas no están en el almacenamiento remoto, así que no se ha cambiado nada aquí. Si lo vaciaste a propósito, desconecta y vuelve a conectar.",
  "sync.error.undecryptable": "No se ha podido descifrar {file}: se modificó o se cifró con otra clave.",
  "sync.error.notSealed": "{file} no es una nota cifrada.",
  "sync.error.unreachableApp": "No se ha podido acceder al endpoint de almacenamiento. Comprueba la URL y tu conexión.",
  "sync.error.unreachableBrowser":
    "No se ha podido acceder al bucket. Comprueba el endpoint y que las reglas CORS del bucket permitan este sitio.",
  "sync.error.wrongKey": "La clave de acceso o el secreto no son correctos.",
  "sync.error.noBucket": "El bucket “{bucket}” no existe en este endpoint.",
  "sync.error.denied": "Acceso denegado. Asegúrate de que la clave pueda leer y escribir en este bucket.",
  "sync.error.service": "El servicio de almacenamiento ha devuelto un error ({status}): {message}",
  "sync.error.status": "El servicio de almacenamiento ha devuelto {status}.",
  "sync.error.notS3": "El endpoint no ha respondido como un almacenamiento S3. Comprueba la URL del endpoint.",

  "sync.conflicted": "{title} (copia en conflicto)",
  "sync.conflictedCopy": "Copia en conflicto",
  "sync.untitled": "Sin título",
} satisfies Translation<typeof en>;
