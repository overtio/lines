import type { Translation } from "../../format";
import type en from "../en/secrets";

export default {
  "secrets.label": "Le secret {name}, gardé dans une note verrouillée",
  "secrets.show": "Afficher {name}",
  "secrets.hide": "Masquer {name}",
  "secrets.copy": "Copier {name}",
  "secrets.missing": "Aucun secret ne s’appelle {name}. Ajoutez-le à une note verrouillée de type secrets.",
} satisfies Translation<typeof en>;
