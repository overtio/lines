import type { Messages } from "../../index.svelte";
import app from "./app";
import editor from "./editor";
import latex from "./latex";
import list from "./list";
import lock from "./lock";
import picker from "./picker";
import pictures from "./pictures";
import plugins from "./plugins";
import print from "./print";
import settings from "./settings";
import shortcuts from "./shortcuts";
import sidebar from "./sidebar";
import sync from "./sync";

export default {
  ...app,
  ...editor,
  ...latex,
  ...list,
  ...lock,
  ...picker,
  ...pictures,
  ...plugins,
  ...print,
  ...settings,
  ...shortcuts,
  ...sidebar,
  ...sync,
} satisfies Messages;
