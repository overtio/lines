import type { Translation } from "../../format";
import type en from "../en/secrets";

export default {
  "secrets.label": "El secreto {name}, guardado en una nota bloqueada",
  "secrets.show": "Mostrar {name}",
  "secrets.hide": "Ocultar {name}",
  "secrets.copy": "Copiar {name}",
  "secrets.missing": "No hay ningún secreto llamado {name}. Añádelo a una nota bloqueada de tipo secrets.",
} satisfies Translation<typeof en>;
