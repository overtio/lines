import type { Translation } from "../../format";
import type en from "../en/pictures";

export default {
  "pictures.from": "Imágenes de {name}",
  "pictures.site": "Abrir el sitio web de {name}",
  "pictures.more": "Mostrar otras",
  "pictures.search": "Buscar",
  "pictures.categories": "Categorías",
  "pictures.pictures": "Imágenes",
  "pictures.searchFor": "Buscar «{query}»",
  "pictures.noMatches": "Nada coincide con «{query}».",
  "pictures.none": "No se encontraron imágenes.",
  "pictures.shown": "{count, plural, one {# imagen} other {# imágenes}}",
  "pictures.failed": "No se pudo conectar con {name}.",
  "pictures.retry": "Reintentar",
} satisfies Translation<typeof en>;
