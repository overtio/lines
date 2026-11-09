import { isApple } from "../lib/platform";
import type { Plugin } from "../lib/plugins/types";
import { arxiv } from "./arxiv";
import { asciinema } from "./asciinema";
import { changesPlugin } from "./changes";
import { code } from "./code";
import { giphy } from "./giphy";
import { github } from "./github";
import { requests } from "./http";
import { ironcalc } from "./ironcalc";
import { katex } from "./katex";
import { latex } from "./latex";
import { lucide } from "./lucide";
import { markdown } from "./markdown";
import { mermaid } from "./mermaid";
import { models } from "./models";
import { paper } from "./paper";
import { pele } from "./pele";
import { secrets } from "./secrets";
import { sfSymbols } from "./sf-symbols";
import { spreadsheet } from "./spreadsheet";
import { tex } from "./tex";
import { themes } from "./themes";
import { unsplash } from "./unsplash";
import { wavedrom } from "./wavedrom";

/*
 * The plugins lines comes with, in the order Settings → Plugins lists them. The core finds them
 * through the registry (lib/plugins), as it would any other plugin, and each is in a folder of its
 * own here.
 */
export const builtIn = (): Plugin[] => [
  markdown(),
  latex(),
  spreadsheet(),
  requests(),
  code(),
  secrets(),
  katex(),
  // Before Mermaid: if both were on, Pele would draw the diagrams.
  pele(),
  mermaid(),
  wavedrom(),
  models(),
  ironcalc(),
  tex(),
  unsplash(),
  giphy(),
  asciinema(),
  github(),
  arxiv(),
  changesPlugin(),
  themes(),
  paper(),
  lucide(),
  // Its symbols may only be used on Apple's platforms.
  ...(isApple ? [sfSymbols()] : []),
];
