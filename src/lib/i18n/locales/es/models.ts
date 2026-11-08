import type { Translation } from "../../format";
import type en from "../en/models";

export default {
  "models.model": "Modelo 3D",
  "models.label": "Modelo 3D, {size}",
  "models.keys": "Las flechas lo giran, con Mayúsculas lo mueven, más y menos acercan y alejan, y 0 lo devuelve a su sitio.",
  "models.reset": "Restablecer vista",
  "models.download": "Descargar modelo",
  "models.reading": "Leyendo el modelo…",
  "models.unreadable": "No se pudo leer este archivo {kind}.",
  "models.empty": "No hay nada que mostrar: el modelo está vacío.",
  "models.noOpenScad": "Esta copia de lines no tiene OpenSCAD, que hace el modelo a partir de su código.",
  "models.noWebGL": "Este dispositivo no puede dibujar en 3D.",
  "models.tooLong": "Tardaba demasiado, así que se detuvo.",
  "models.failed": "Algo salió mal.",
} satisfies Translation<typeof en>;
