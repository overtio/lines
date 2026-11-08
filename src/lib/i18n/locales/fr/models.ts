import type { Translation } from "../../format";
import type en from "../en/models";

export default {
  "models.model": "Modèle 3D",
  "models.label": "Modèle 3D, {size}",
  "models.keys": "Les flèches le font tourner, avec Maj elles le déplacent, plus et moins zooment, et 0 le remet en place.",
  "models.reset": "Réinitialiser la vue",
  "models.download": "Télécharger le modèle",
  "models.reading": "Lecture du modèle…",
  "models.unreadable": "Impossible de lire ce fichier {kind}.",
  "models.empty": "Rien à afficher : le modèle est vide.",
  "models.noOpenScad": "Cette copie de lines n’a pas OpenSCAD, qui fait le modèle à partir de son code.",
  "models.noWebGL": "Cet appareil ne peut pas dessiner en 3D.",
  "models.tooLong": "C’était trop long, alors ça a été arrêté.",
  "models.failed": "Une erreur s’est produite.",
} satisfies Translation<typeof en>;
