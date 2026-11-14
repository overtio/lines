/*
 * English, the language every message is written in first. Each area of the app has a file of its
 * own; a message's key starts with its area. Other languages mirror these files (docs/translations.md).
 */
import app from "./app";
import books from "./books";
import calendar from "./calendar";
import editor from "./editor";
import feeds from "./feeds";
import http from "./http";
import hurl from "./hurl";
import importing from "./import";
import latex from "./latex";
import library from "./library";
import list from "./list";
import lock from "./lock";
import models from "./models";
import picker from "./picker";
import player from "./player";
import plugins from "./plugins";
import print from "./print";
import readwise from "./readwise";
import secrets from "./secrets";
import settings from "./settings";
import sheet from "./sheet";
import shortcuts from "./shortcuts";
import sidebar from "./sidebar";
import sync from "./sync";

export default {
  ...app,
  ...books,
  ...calendar,
  ...editor,
  ...feeds,
  ...http,
  ...hurl,
  ...importing,
  ...latex,
  ...library,
  ...list,
  ...lock,
  ...models,
  ...picker,
  ...player,
  ...plugins,
  ...print,
  ...readwise,
  ...secrets,
  ...settings,
  ...sheet,
  ...shortcuts,
  ...sidebar,
  ...sync,
};
