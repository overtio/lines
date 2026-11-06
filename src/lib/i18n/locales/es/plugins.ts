import type { Translation } from "../../format";
import type en from "../en/plugins";

export default {
  "plugins.intro":
    "Casi todo lines son complementos: los formatos en que se escriben las notas, lo que dibuja las fórmulas y los diagramas, y su aspecto. Desactiva lo que no uses. Una nota en un formato desactivado se muestra como texto sin formato, y nada en ella cambia.",
  "plugins.groupFormats": "Formatos",
  "plugins.groupEngines": "Dibujo y composición",
  "plugins.groupLook": "Aspecto",
  "plugins.groupMore": "Más",
  "plugins.alwaysOn": "Siempre activo",
  "plugins.needs": "Necesita {names}, que está desactivado.",
  "plugins.plainText": "Texto sin formato",
  "plugins.markdown.description": "Notas escritas en Markdown, con formato mientras escribes y los añadidos de lines: destacados, resaltados, etiquetas y menciones.",
  "plugins.latex.description": "Notas escritas en LaTeX, dibujadas mientras escribes y exportadas como documentos que compilan.",
  "plugins.katex": "Fórmulas (KaTeX)",
  "plugins.katex.description": "Dibuja las fórmulas en notas de cualquier formato, en pantalla y en papel.",
  "plugins.mermaid": "Diagramas (Mermaid)",
  "plugins.mermaid.description": "Dibuja los bloques de código mermaid como diagramas de flujo, de secuencia y más, y añade /diagrama.",
  "plugins.tex": "Composición con TeX",
  "plugins.tex.description": "Compone el PDF de una nota LaTeX con el propio TeX, en lugar de las páginas de lines.",
  "plugins.themes": "Temas",
  "plugins.themes.description": "Lines y quince más, entre ellos Alto contraste y dos para el daltonismo.",
  "plugins.lucide.description": "Los iconos de lines, de Lucide.",
  "plugins.sfSymbols.description": "Los iconos de Apple, dibujados por tu Mac, iPhone o iPad.",
  "plugins.groupPictures": "Imágenes y GIF",
  "plugins.nekosBest.description": "GIF de reacciones de anime e imágenes de nekos, kitsunes, waifus y husbandos, todo apto para el trabajo. Búscalos por anime o artista. Escribe /nekos para elegir uno.",
  "plugins.gifukai.description": "GIF de reacciones de anime, de abrazos a choques de manos, cada uno con el anime del que viene. Escribe /gifukai para elegir uno.",
  "plugins.otakugifs.description": "GIF de reacciones de anime, de setenta tipos. Escribe /otakugifs para elegir uno.",
  "plugins.purrbot.description": "GIF e imágenes de anime de la colección apta para el trabajo de Purr Bot. Escribe /purr para elegir uno.",
  "plugins.appsOnly": "Solo en las apps de lines: {name} no deja que los sitios web pidan sus imágenes.",
} satisfies Translation<typeof en>;
