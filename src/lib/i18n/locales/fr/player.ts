import type { Translation } from "../../format";
import type en from "../en/player";

export default {
  "player.label": "Lecteur de podcasts",
  "player.show": "Afficher l’épisode",
  "player.close": "Arrêter et fermer le lecteur",
  "player.play": "Lire",
  "player.pause": "Pause",
  "player.back": "Reculer de {seconds} secondes",
  "player.forward": "Avancer de {seconds} secondes",
  "player.speed": "Vitesse : {speed}",
  "player.position": "Position dans l’épisode",
  "player.time": "{elapsed} écoutées, {left} restantes",
  "player.couldntPlay": "Cet épisode n’a pas pu être lu. Appuyez sur Lire pour réessayer.",
  "player.playEpisode": "Lire l’épisode",
  "player.pauseEpisode": "Mettre l’épisode en pause",
  "player.played": "Écouté",
  "player.left": "{time} restantes",
  "player.markPlayed": "Marquer comme écouté",
  "player.markUnplayed": "Marquer comme non écouté",
} satisfies Translation<typeof en>;
