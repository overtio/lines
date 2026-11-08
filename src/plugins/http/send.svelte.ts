import { t } from "../../lib/i18n/index.svelte";
import { isTauri, webFetch } from "../../lib/platform";
import type { Asked } from "./curl";
import type { ResponseValues } from "./variables";

/*
 * Sending a request and keeping its response. In the native apps a request goes through Rust
 * (Tauri's HTTP plugin), so any API answers; in the browser it's a plain fetch, which only APIs that
 * allow other sites (CORS) answer. Nothing is kept once lines closes.
 */

export interface Received extends ResponseValues {
  status: number;
  statusText: string;
  /** Where the response came from, after any redirects. */
  url: string;
  bytes: Uint8Array;
  /** Its media type, without parameters: "application/json". */
  type: string;
  /** Whether its body is text, as `text`. */
  isText: boolean;
  /** From sending to the last of the body, in milliseconds. */
  time: number;
}

/** What a status means, for responses that don't say (HTTP/2 and 3 don't). */
const REASONS: Record<number, string> = {
  200: "OK", 201: "Created", 202: "Accepted", 204: "No Content", 206: "Partial Content",
  301: "Moved Permanently", 302: "Found", 303: "See Other", 304: "Not Modified", 307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 406: "Not Acceptable",
  408: "Request Timeout", 409: "Conflict", 410: "Gone", 413: "Content Too Large", 415: "Unsupported Media Type",
  422: "Unprocessable Content", 429: "Too Many Requests",
  500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
};

/** Media types whose bodies are text, besides text/*. */
const TEXT = /json|xml|javascript|ecmascript|x-www-form-urlencoded|graphql|yaml|csv|html|svg/;
/** Headers set by what sends the request, from the body or the connection. */
const SET_FOR_US = new Set(["content-length", "transfer-encoding", "connection"]);

function decode(bytes: Uint8Array, contentType: string) {
  const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().replace(/"/g, "");
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

/** Whether a body with no media type, or an unknown one, reads as text: nothing undecodable, no control characters but spacing. */
function looksLikeText(text: string) {
  for (let i = 0; i < Math.min(text.length, 4096); i++) {
    const code = text.charCodeAt(i);
    if (code === 0xfffd || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0c && code !== 0x0d)) return false;
  }
  return true;
}

/** What went wrong, as the response says it. */
function failure(error: unknown, url: string) {
  const message = error instanceof Error ? error.message : String(error);
  if (/not allowed on the configured scope|url not allowed/i.test(message)) return t("http.error.scope");
  if (!isTauri) return t("http.error.browser", { host: new URL(url).host });
  return t("http.error.network", { error: message });
}

/** A request sent, or being sent, and what came back. */
export class Exchange {
  state = $state<"sending" | "received" | "failed">("sending");
  received = $state.raw<Received | null>(null);
  error = $state("");
  readonly #abort = new AbortController();

  constructor(
    /** The request as it was sent, variables filled in; what was written, if they couldn't be. */
    readonly asked: Asked,
    /** Its `# @name`, by which the requests after it use its response. */
    readonly name: string | null,
    /** The secrets' values it was sent with, shown as dots. */
    readonly hidden: readonly string[] = [],
  ) {}

  /** Its address as shown: with any secret in it as dots. */
  get shownUrl() {
    return this.hidden.reduce((url, value) => (value ? url.replaceAll(value, "••••") : url), this.asked.url);
  }

  /** Sent no further: it couldn't be, for `reason`. */
  fail(reason: string) {
    this.state = "failed";
    this.error = reason;
  }

  cancel() {
    this.#abort.abort();
  }

  async send() {
    const { method, url, headers, body } = this.asked;
    const sent = new Headers();
    try {
      for (const [name, value] of headers) if (!SET_FOR_US.has(name.toLowerCase())) sent.append(name, value);
    } catch {
      return this.fail(t("http.error.header"));
    }
    // Tauri's plugin otherwise says the request comes from lines' page, which some APIs refuse.
    if (isTauri && !sent.has("Origin")) sent.set("Origin", "");
    const started = performance.now();
    try {
      const fetch = await webFetch();
      const response = await fetch(url, {
        method,
        headers: sent,
        body: body !== null && method !== "GET" && method !== "HEAD" ? body : undefined,
        signal: this.#abort.signal,
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") ?? "";
      const type = contentType.split(";")[0].trim().toLowerCase();
      const text = decode(bytes, contentType);
      this.received = {
        status: response.status,
        statusText: response.statusText || REASONS[response.status] || "",
        url: response.url || url,
        headers: [...response.headers],
        bytes,
        text,
        type,
        isText: type.startsWith("text/") || TEXT.test(type) || (!type.startsWith("image/") && looksLikeText(text)),
        time: performance.now() - started,
      };
      this.state = "received";
    } catch (error) {
      this.fail(this.#abort.signal.aborted ? t("http.cancelled") : failure(error, url));
    }
  }
}
