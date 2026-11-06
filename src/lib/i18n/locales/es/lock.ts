import type { Translation } from "../../format";
import type en from "../en/lock";

export default {
  "lock.form.passphrase": "Frase de contraseña",
  "lock.form.password": "Contraseña",
  "lock.form.currentPassphrase": "Frase de contraseña actual",
  "lock.form.currentPassword": "Contraseña actual",
  "lock.form.newPassphrase": "Nueva frase de contraseña",
  "lock.form.newPassword": "Nueva contraseña",
  "lock.form.again": "Vuelve a escribirla",
  "lock.form.tooShort": "Usa al menos {count} caracteres. Unas cuantas palabras que vayas a recordar funcionan bien.",
  "lock.form.passphrasesDiffer": "Las dos frases de contraseña no coinciden.",
  "lock.form.passwordsDiffer": "Las dos contraseñas no coinciden.",
  "lock.cancel": "Cancelar",

  "lock.app.title": "Bloqueo de la app",
  "lock.app.intro":
    "Bloquea lines con una frase de contraseña. Tus notas, archivos adjuntos y ajustes de sincronización de este dispositivo se cifran, y lines te pide la frase de contraseña al abrirse.",
  "lock.app.setUp": "Configurar el bloqueo de la app…",
  "lock.app.turnOn": "Activar el bloqueo de la app",
  "lock.app.encrypting": "Cifrando las notas…",
  "lock.app.turnedOn": "El bloqueo de la app está activado. lines te pedirá la frase de contraseña al abrirse.",
  "lock.app.forget":
    "Si la olvidas, las notas de este dispositivo no se podrán abrir, ni siquiera con lines. Las notas sincronizadas siguen a salvo en tu almacenamiento de sincronización.",
  "lock.app.on": "Las notas de este dispositivo están cifradas, y lines te pide la frase de contraseña al abrirse.",
  "lock.app.after": "Bloquear tras",
  "lock.app.afterLabel": "Bloquear tras este tiempo sin uso",
  "lock.app.never": "Nunca",
  "lock.app.minutes": "{count} min",
  "lock.app.hour": "1 hora",
  "lock.app.afterHint": "Tras ese tiempo sin uso, lines se bloquea solo.",
  "lock.app.neverHint": "lines se bloquea al salir, o cuando lo bloqueas tú.",
  "lock.app.askTurnOff": "Desactivar…",
  "lock.app.askChange": "Cambiar la frase de contraseña…",
  "lock.app.change": "Cambiar la frase de contraseña",
  "lock.app.changed": "Frase de contraseña cambiada.",
  "lock.app.turnOffHint": "Tus notas se guardarán en este dispositivo sin cifrar, como antes.",
  "lock.app.turnOff": "Desactivar el bloqueo de la app",
  "lock.app.decrypting": "Descifrando las notas…",
  "lock.app.turnedOff": "El bloqueo de la app está desactivado.",
  "lock.lockNow": "Bloquear ahora",
  "lock.lockShortcut": "Bloquear ({shortcut})",
  "lock.changing": "Cambiando…",
  "lock.unlockWithTouchId": "Desbloquear con Touch ID",
  "lock.useTouchId": "Usar Touch ID",
  "lock.touchId.turnOnFailed": "No se ha podido activar Touch ID: {error}",
  "lock.touchId.turnOffFailed": "No se ha podido desactivar Touch ID: {error}",
  "lock.touchId.failed": "Touch ID no ha funcionado: {error}",

  "lock.notes.title": "Notas bloqueadas",
  "lock.notes.intro":
    "Bloquea una nota para ocultar su contenido hasta que introduzcas una contraseña: elige Bloquear nota en su menú, o el candado de su barra de herramientas. La primera vez, eliges la contraseña.",
  "lock.notes.introHint":
    "Una nota bloqueada se cifra, aquí y allá donde se sincronice. Su título sigue siendo legible, para que la lista pueda mostrarlo.",
  "lock.notes.open":
    "Las notas bloqueadas están abiertas. Se vuelven a bloquear tras {minutes, plural, one {# minuto} other {# minutos}} sin uso, o cuando las bloqueas.",
  "lock.notes.withPassword": "Las notas bloqueadas se abren con tu contraseña.",
  "lock.notes.withPasswordOrTouchId": "Las notas bloqueadas se abren con tu contraseña o con Touch ID.",
  "lock.notes.fromOtherDevices": "Las notas bloqueadas en tus otros dispositivos se abren con la contraseña que elegiste allí.",
  "lock.notes.touchId": "Abrir las notas bloqueadas con Touch ID",
  "lock.notes.askForgot": "He olvidado la contraseña…",
  "lock.notes.askChange": "Cambiar la contraseña…",
  "lock.notes.changeHint": "Todas las notas bloqueadas con la contraseña actual se abrirán con la nueva, en todos tus dispositivos.",
  "lock.notes.change": "Cambiar la contraseña",
  "lock.notes.changed": "Contraseña cambiada.",
  "lock.notes.resetHint":
    "Elige una nueva contraseña para las notas que bloquees a partir de ahora. Las notas ya bloqueadas solo se abren con la antigua, así que mantenlas bloqueadas hasta que la recuerdes.",
  "lock.notes.reset": "Establecer la nueva contraseña",
  "lock.notes.resetting": "Estableciendo…",
  "lock.notes.wasReset": "Nueva contraseña establecida. Las notas que bloquees a partir de ahora la usarán.",
  "lock.notes.touchIdHint": "Introduce la contraseña de las notas bloqueadas para que Touch ID pueda abrirlas.",
  "lock.notes.turningOn": "Activando…",
  "lock.notes.notOpen": "Abre primero tus notas bloqueadas.",

  "lock.synced.title": "Notas sincronizadas",
  "lock.synced.intro":
    "Para cifrar las notas antes de que salgan de este dispositivo, de modo que tu proveedor de almacenamiento no pueda leerlas, activa el cifrado de extremo a extremo en Ajustes → Sincronización.",
  "lock.synced.open": "Ir a Sincronización",

  "lock.screen.title": "lines está bloqueado",
  "lock.screen.hint": "Introduce tu frase de contraseña para abrir tus notas.",
  "lock.screen.unlock": "Desbloquear",
  "lock.screen.unlocking": "Desbloqueando…",
  "lock.screen.unlockFailed": "No se ha podido desbloquear: {error}",
  "lock.screen.forgot": "¿Has olvidado tu frase de contraseña?",
  "lock.screen.forgotHint":
    "Sin ella, las notas de este dispositivo no se pueden abrir, ni siquiera con lines. Si sincronizas, tus notas siguen en tu almacenamiento de sincronización: borra este dispositivo y vuelve a conectar la sincronización.",
  "lock.screen.askErase": "Borrar este dispositivo…",
  "lock.screen.eraseQuestion":
    "¿Borrar todas las notas y archivos adjuntos de este dispositivo, y sus ajustes de sincronización? Las notas que se sincronizaron siguen en tu almacenamiento de sincronización. Esta acción no se puede deshacer.",
  "lock.screen.erase": "Borrar",

  "lock.floating.title": "Bloqueado",
  "lock.floating.unlock": "Desbloquear…",

  "lock.note.untitled": "Sin título",
  "lock.note.hint": "Esta nota está bloqueada. Introduce la contraseña de las notas bloqueadas para verla.",
  "lock.note.passwordLabel": "Contraseña de las notas bloqueadas",
  "lock.note.view": "Ver la nota",
  "lock.note.opening": "Abriendo…",
  "lock.note.forgot": "¿Has olvidado la contraseña?",
  "lock.note.forgotHint":
    "Sin su contraseña, una nota bloqueada no se puede abrir, ni siquiera con lines. Puedes establecer una nueva contraseña para las notas que bloquees a partir de ahora.",
  "lock.note.openPrivacy": "Abrir los ajustes de privacidad",

  "lock.dialog.setTitle": "Establece una contraseña para las notas bloqueadas",
  "lock.dialog.setIntro":
    "Abre todas las notas que bloquees, aquí y en tus otros dispositivos. Los títulos de las notas bloqueadas siguen apareciendo en la lista.",
  "lock.dialog.setHint": "Si la olvidas, las notas que bloquees con ella no se podrán abrir, ni siquiera con lines.",
  "lock.dialog.openTitle": "Introduce la contraseña de las notas bloqueadas",
  "lock.dialog.openIntro": "Tus notas bloqueadas también se abren, hasta que las vuelvas a bloquear.",
  "lock.dialog.lockNote": "Bloquear nota",
  "lock.dialog.locking": "Bloqueando…",

  "lock.error.wrongPassphrase": "Esa frase de contraseña no es correcta.",
  "lock.error.wrongPassword": "Esa contraseña no es correcta.",
  "lock.error.otherPassword": "Se han abierto otras notas bloqueadas, pero esta se bloqueó con otra contraseña.",
  "lock.error.notEncrypted": "Esto no lo ha cifrado lines.",
  "lock.error.unreadable": "No se ha podido descifrar: se modificó, se dañó o se cifró con otra clave.",
  "lock.error.unknownFormat": "Esta clave tiene un formato que lines no conoce, quizá de una versión más reciente de lines.",
} satisfies Translation<typeof en>;
