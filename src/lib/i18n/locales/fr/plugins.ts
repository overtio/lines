import type { Translation } from "../../format";
import type en from "../en/plugins";

export default {
  "plugins.intro":
    "Presque tout lines est fait d’extensions : les formats dans lesquels s’écrivent les notes, ce qui dessine les formules et les diagrammes, et son apparence. Désactivez ce dont vous ne vous servez pas. Une note dans un format désactivé s’affiche en texte brut, et rien n’y change.",
  "plugins.groupFormats": "Formats",
  "plugins.groupEngines": "Dessin et composition",
  "plugins.groupLook": "Apparence",
  "plugins.groupMore": "Plus",
  "plugins.alwaysOn": "Toujours activée",
  "plugins.needs": "Nécessite {names}, qui est désactivée.",
  "plugins.plainText": "Texte brut",
  "plugins.markdown.description": "Des notes écrites en Markdown, mises en forme à la frappe, avec les ajouts de lines : encadrés, surlignages, étiquettes et mentions.",
  "plugins.latex.description": "Des notes écrites en LaTeX, dessinées à la frappe, et exportées en documents qui compilent.",
  "plugins.katex": "Formules (KaTeX)",
  "plugins.katex.description": "Dessine les formules dans les notes de tout format, à l’écran et sur papier.",
  "plugins.mermaid": "Diagrammes (Mermaid)",
  "plugins.mermaid.description": "Dessine les blocs de code mermaid en organigrammes, diagrammes de séquence et autres, et ajoute /diagramme.",
  "plugins.tex": "Composition avec TeX",
  "plugins.tex.description": "Compose le PDF d’une note LaTeX avec TeX lui-même, au lieu des pages de lines.",
  "plugins.themes": "Thèmes",
  "plugins.themes.description": "Lines et quinze autres, dont Contraste élevé et deux pour le daltonisme.",
  "plugins.lucide.description": "Les icônes de lines, de Lucide.",
  "plugins.sfSymbols.description": "Les icônes d’Apple, dessinées par votre Mac, iPhone ou iPad.",
} satisfies Translation<typeof en>;
