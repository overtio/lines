import { isApple } from "../lib/platform";
import type { Plugin } from "../lib/plugins/types";
import { katex } from "./katex";
import { latex } from "./latex";
import { lucide } from "./lucide";
import { markdown } from "./markdown";
import { mermaid } from "./mermaid";
import { sfSymbols } from "./sf-symbols";
import { tex } from "./tex";
import { themes } from "./themes";

/*
 * The plugins lines comes with, in the order Settings → Plugins lists them. The core finds them
 * through the registry (lib/plugins), as it would any other plugin, and each is in a folder of its
 * own here.
 */
export const builtIn = (): Plugin[] => [
  markdown(),
  latex(),
  katex(),
  mermaid(),
  tex(),
  themes(),
  lucide(),
  // Its symbols may only be used on Apple's platforms.
  ...(isApple ? [sfSymbols()] : []),
];
