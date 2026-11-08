import { parseHurl, writeHurl } from "./hurl/parse";
import { parseHttp, writeHttp } from "./parse";
import type { Dialect } from "./request";

/** The .http format: requests between `###` lines, sent one at a time or all, whatever each gets back. */
export const http: Dialect = { id: "http", blocks: /^(?:http|rest)$/, read: parseHttp, write: writeHttp, separator: "###\n", stops: false };

/** Hurl: entries one after another, each checking its response; sending them all stops at the first that fails. */
export const hurl: Dialect = { id: "hurl", blocks: /^hurl$/, read: parseHurl, write: writeHurl, separator: "", stops: true };
