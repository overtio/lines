import type { Messages } from "../../index.svelte";
import app from "./app";
import calendar from "./calendar";
import editor from "./editor";
import feeds from "./feeds";
import http from "./http";
import hurl from "./hurl";
import latex from "./latex";
import library from "./library";
import list from "./list";
import lock from "./lock";
import models from "./models";
import picker from "./picker";
import player from "./player";
import plugins from "./plugins";
import print from "./print";
import secrets from "./secrets";
import settings from "./settings";
import sheet from "./sheet";
import shortcuts from "./shortcuts";
import sidebar from "./sidebar";
import sync from "./sync";

export default {
  ...app,
  ...calendar,
  ...editor,
  ...feeds,
  ...http,
  ...hurl,
  ...latex,
  ...library,
  ...list,
  ...lock,
  ...models,
  ...picker,
  ...player,
  ...plugins,
  ...print,
  ...secrets,
  ...settings,
  ...sheet,
  ...shortcuts,
  ...sidebar,
  ...sync,
} satisfies Messages;
