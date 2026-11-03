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
} satisfies Translation<typeof en>;
