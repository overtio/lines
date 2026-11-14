import { isApple } from "../lib/platform";
import type { Plugin } from "../lib/plugins/types";
import { anilist } from "./anilist";
import { applePodcasts } from "./apple-podcasts";
import { arxiv } from "./arxiv";
import { asciinema } from "./asciinema";
import { changesPlugin } from "./changes";
import { code } from "./code";
import { feedsPlugin } from "./feeds";
import { fonts } from "./fonts";
import { giphy } from "./giphy";
import { wallhaven } from "./wallhaven";
import { github } from "./github";
import { hackerNews } from "./hacker-news";
import { requests } from "./http";
import { ironcalc } from "./ironcalc";
import { katex } from "./katex";
import { latex } from "./latex";
import { library } from "./library";
import { lucide } from "./lucide";
import { markdown } from "./markdown";
import { mermaid } from "./mermaid";
import { models } from "./models";
import { musicbrainz } from "./musicbrainz";
import { myanimelist } from "./myanimelist";
import { openLibrary } from "./open-library";
import { paper } from "./paper";
import { pdfReader } from "./pdf-reader";
import { epubReader } from "./epub-reader";
import { pele } from "./pele";
import { readwise } from "./readwise";
import { secrets } from "./secrets";
import { sfSymbols } from "./sf-symbols";
import { soundcloud } from "./soundcloud";
import { spotify } from "./spotify";
import { spreadsheet, spreadsheetNotes } from "./spreadsheet";
import { tex } from "./tex";
import { keyboardSounds } from "./keyboards";
import { mascots } from "./mascots";
import { styles } from "./styles";
import { themes } from "./themes";
import { typing } from "./typing";
import { unsplash } from "./unsplash";
import { wavedrom } from "./wavedrom";
import { webPages } from "./web-pages";
import { wikidata } from "./wikidata";
import { youtube } from "./youtube";

/*
 * The plugins lines comes with, in the order Settings → Plugins lists them. The core finds them
 * through the registry (lib/plugins), as it would any other plugin, and each is in a folder of its
 * own here.
 */
export const builtIn = (): Plugin[] => [
  markdown(),
  latex(),
  spreadsheet(),
  spreadsheetNotes(),
  requests(),
  code(),
  secrets(),
  katex(),
  // Before Mermaid: if both were on, Pele would draw the diagrams.
  pele(),
  mermaid(),
  wavedrom(),
  models(),
  typing(),
  ironcalc(),
  tex(),
  unsplash(),
  giphy(),
  wallhaven(),
  asciinema(),
  github(),
  arxiv(),
  // The library, and where it looks links up: each site, then any page, then a page's site's feed (asked last).
  library(),
  youtube(),
  openLibrary(),
  wikidata(),
  musicbrainz(),
  anilist(),
  myanimelist(),
  spotify(),
  soundcloud(),
  applePodcasts(),
  webPages(),
  feedsPlugin(),
  hackerNews(),
  // Bringing a library in from another app.
  readwise(),
  // Books kept with library notes, read in the note's place.
  pdfReader(),
  epubReader(),
  changesPlugin(),
  themes(),
  styles(),
  fonts(),
  paper(),
  keyboardSounds(),
  mascots(),
  lucide(),
  // Its symbols may only be used on Apple's platforms.
  ...(isApple ? [sfSymbols()] : []),
];
