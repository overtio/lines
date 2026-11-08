/*
 * English, the language every message is written in first. Each area of the app has a file of its
 * own; a message's key starts with its area. Other languages mirror these files (docs/translations.md).
 */
import app from "./app";
import editor from "./editor";
import http from "./http";
import hurl from "./hurl";
import latex from "./latex";
import list from "./list";
import lock from "./lock";
import picker from "./picker";
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
  ...editor,
  ...http,
  ...hurl,
  ...latex,
  ...list,
  ...lock,
  ...picker,
  ...plugins,
  ...print,
  ...secrets,
  ...settings,
  ...sheet,
  ...shortcuts,
  ...sidebar,
  ...sync,
};
