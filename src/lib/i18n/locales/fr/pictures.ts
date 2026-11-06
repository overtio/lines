import type { Translation } from "../../format";
import type en from "../en/pictures";

export default {
  "pictures.from": "Images de {name}",
  "pictures.site": "Ouvrir le site de {name}",
  "pictures.more": "En montrer d’autres",
  "pictures.search": "Rechercher",
  "pictures.categories": "Catégories",
  "pictures.pictures": "Images",
  "pictures.searchFor": "Rechercher « {query} »",
  "pictures.noMatches": "Rien ne correspond à « {query} ».",
  "pictures.none": "Aucune image trouvée.",
  "pictures.shown": "{count, plural, one {# image} other {# images}}",
  "pictures.failed": "Impossible de joindre {name}.",
  "pictures.retry": "Réessayer",
} satisfies Translation<typeof en>;
