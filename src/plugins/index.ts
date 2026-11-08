import { isApple } from "../lib/platform";
import type { Plugin } from "../lib/plugins/types";
import { giphy } from "./giphy";
import { requests } from "./http";
import { ironcalc } from "./ironcalc";
import { katex } from "./katex";
import { latex } from "./latex";
import { lucide } from "./lucide";
import { markdown } from "./markdown";
import { mermaid } from "./mermaid";
import { pele } from "./pele";
import { secrets } from "./secrets";
import { sfSymbols } from "./sf-symbols";
import { spreadsheet } from "./spreadsheet";
import { tex } from "./tex";
import { themes } from "./themes";
import { unsplash } from "./unsplash";

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
  secrets(),
  katex(),
  // Before Mermaid: if both were on, Pele would draw the diagrams.
  pele(),
  mermaid(),
  ironcalc(),
  tex(),
  unsplash(),
  giphy(),
  themes(),
  lucide(),
  // Its symbols may only be used on Apple's platforms.
  ...(isApple ? [sfSymbols()] : []),
];
