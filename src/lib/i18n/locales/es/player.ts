import type { Translation } from "../../format";
import type en from "../en/player";

export default {
  "player.label": "Reproductor de podcasts",
  "player.show": "Mostrar el episodio",
  "player.close": "Detener y cerrar el reproductor",
  "player.play": "Reproducir",
  "player.pause": "Pausar",
  "player.back": "Retroceder {seconds} segundos",
  "player.forward": "Avanzar {seconds} segundos",
  "player.speed": "Velocidad: {speed}",
  "player.position": "Posición en el episodio",
  "player.time": "{elapsed} escuchado, quedan {left}",
  "player.couldntPlay": "No se ha podido reproducir este episodio.",
  "player.playEpisode": "Reproducir el episodio",
  "player.pauseEpisode": "Pausar el episodio",
  "player.played": "Escuchado",
  "player.left": "Quedan {time}",
  "player.markPlayed": "Marcar como escuchado",
  "player.markUnplayed": "Marcar como no escuchado",
} satisfies Translation<typeof en>;
