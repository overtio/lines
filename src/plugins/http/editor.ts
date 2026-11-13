import { ensureSyntaxTree, HighlightStyle, type Language, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, MapMode, Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { mount, unmount } from "svelte";
import { speak } from "../../lib/a11y";
import { fenceFor } from "../../lib/editor/codeFence";
import { fenceAt, fenceLanguage } from "../../lib/editor/rendered";
import { copyButton, destroyCopyButton } from "../../lib/editor/keyValue";
import { outlineHeadings } from "../../lib/editor/outline.svelte";
import Icon from "../../lib/icons/Icon.svelte";
import { t } from "../../lib/i18n/index.svelte";
import { secrets } from "../../lib/notes/secrets.svelte";
import { modKey } from "../../lib/platform";
import { type Asked, readCurl, shellVariable, toCurl } from "./curl";
import { http, hurl } from "./dialects";
import { check, type Say } from "./hurl/check";
import { hurlLanguage } from "./hurl/language";
import { httpLanguage } from "./language";
import type { Dialect, ReadText, Request } from "./request";
import Response from "./Response.svelte";
import { Exchange } from "./send.svelte";
import { fillIn, fillInWhatCan, type Scope, VariableError } from "./variables";

/*
 * Sending requests from a note, in .http or Hurl (dialects.ts): Send (and ⌘↵ in a request), the
 * response under it with what a Hurl entry checks, Copy as curl, and curl commands pasted into a
 * request written as one. In .http and .hurl notes the whole note is requests; in Markdown notes,
 * each ```http or ```hurl block is. Responses, and what Hurl entries capture, last until lines
 * quits, for the requests after them to use.
 */

/** Where a note's requests are, and the format they're written in. */
interface Where {
  dialect: Dialect;
  /** The stretches of request text between `from` and `to`. */
  sections(state: EditorState, from: number, to: number): { from: number; to: number }[];
  /** Where the response to the request whose line starts at `line` goes, if it's still there. */
  responseAt(state: EditorState, line: number): number | null;
  /** Whether a response can be written into the note as a code block. */
  markdown: boolean;
}

/** Text read as requests, by format and text, so drawing again doesn't read it again. */
const read = new Map<string, ReadText>();

function parsed(dialect: Dialect, text: string) {
  const key = `${dialect.id}\u0000${text}`;
  let found = read.get(key);
  if (!found) {
    if (read.size >= 64) read.delete(read.keys().next().value!);
    read.set(key, (found = dialect.read(text)));
  }
  return found;
}

/** The requests between `from` and `to`, where they are in the note, and the variables written there. */
function requestsIn(state: EditorState, where: Where, from = 0, to = state.doc.length) {
  const requests: Request[] = [];
  const variables = new Map<string, string>();
  for (const section of where.sections(state, from, to)) {
    const text = parsed(where.dialect, state.sliceDoc(section.from, section.to));
    const at = (pos: number) => pos + section.from;
    for (const request of text.requests) {
      requests.push({ ...request, from: at(request.from), line: at(request.line), lineEnd: at(request.lineEnd), to: at(request.to), end: at(request.end) });
      for (const [name, value] of request.variables ?? []) variables.set(name, value);
    }
    for (const [name, value] of text.variables) variables.set(name, value);
  }
  return { requests, variables };
}

/** Blocks a code block can't be inside, which aren't looked through. */
const NO_CODE = new Set(["Paragraph", "ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6", "SetextHeading1", "SetextHeading2", "Table", "HTMLBlock", "CodeBlock", "CommentBlock", "LinkReference", "HorizontalRule"]);

/** All of a .http or .hurl note. */
function wholeNote(dialect: Dialect): Where {
  const where: Where = {
    dialect,
    sections: (state) => [{ from: 0, to: state.doc.length }],
    responseAt: (state, line) => requestsIn(state, where).requests.find((request) => request.line === line)?.to ?? null,
    markdown: false,
  };
  return where;
}

/** The code of each block of `dialect`'s requests in a Markdown note. */
function codeBlocks(dialect: Dialect): Where {
  const where: Where = {
    dialect,
    sections(state, from, to) {
      const found: { from: number; to: number }[] = [];
      const tree = to > syntaxTree(state).length ? (ensureSyntaxTree(state, to, 200) ?? syntaxTree(state)) : syntaxTree(state);
      tree.iterate({
        from,
        to,
        enter: (node) => {
          if (NO_CODE.has(node.name)) return false;
          if (node.name !== "FencedCode") return;
          const info = node.node.getChild("CodeInfo");
          const code = node.node.getChild("CodeText");
          if (info && code && dialect.blocks.test(fenceLanguage(state.sliceDoc(info.from, info.to)))) found.push({ from: code.from, to: code.to });
          return false;
        },
      });
      return found;
    },
    responseAt(state, line) {
      const block = fenceAt(state, line);
      if (!block || !where.sections(state, block.from, block.to).length) return null;
      return state.doc.lineAt(block.to).to;
    },
    markdown: true,
  };
  return where;
}

/* Responses. */

interface Shown {
  /** Where its request's line starts. */
  line: number;
  exchange: Exchange;
}

interface Responses {
  shown: readonly Shown[];
  /** Every request sent while the note's been open, the last last, for later requests to use their responses. */
  sent: readonly Exchange[];
  decorations: DecorationSet;
}

const show = StateEffect.define<Shown>({ map: (value, changes) => ({ ...value, line: changes.mapPos(value.line, -1) }) });
const hide = StateEffect.define<Exchange>();

/** As many requests as are kept for their responses. */
const KEEP = 50;

const mounted = new WeakMap<HTMLElement, { component: Record<string, unknown>; watch: ResizeObserver }>();

class ResponseWidget extends WidgetType {
  constructor(
    readonly exchange: Exchange,
    readonly where: Where,
    readonly field: StateField<Responses>,
  ) {
    super();
  }
  eq(other: ResponseWidget) {
    return other.exchange === this.exchange;
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cm-http-response";
    const { exchange, where, field } = this;
    const close = () => view.dispatch({ effects: hide.of(exchange) });
    const writable = !view.state.readOnly;
    const addToNote = where.markdown && writable ? (text: string, language: string) => writeIntoNote(view, dom, exchange, text, language) : undefined;
    const follow = writable ? (url: string) => void followAddress(view, where, field, exchange, url) : undefined;
    const component = mount(Response, { target: dom, props: { exchange, close, addToNote, follow } });
    // Its height changes as the response arrives, or another tab is chosen.
    const watch = new ResizeObserver(() => view.requestMeasure());
    watch.observe(dom);
    mounted.set(dom, { component, watch });
    return dom;
  }
  destroy(dom: HTMLElement) {
    const parts = mounted.get(dom);
    if (!parts) return;
    void unmount(parts.component);
    parts.watch.disconnect();
    mounted.delete(dom);
  }
  get estimatedHeight() {
    return 160;
  }
  ignoreEvent() {
    return true;
  }
}

/** A response's body, as a code block after the requests' block; the response then closes. */
function writeIntoNote(view: EditorView, dom: HTMLElement, exchange: Exchange, text: string, language: string) {
  const at = view.posAtDOM(dom);
  const fence = fenceFor(text);
  const insert = `\n\n${fence}${language}\n${text}\n${fence}`;
  view.dispatch({
    changes: { from: at, insert },
    effects: hide.of(exchange),
    selection: { anchor: at + insert.length },
    scrollIntoView: true,
    userEvent: "input",
  });
  speak(t("http.added"));
}

function drawResponses(state: EditorState, where: Where, field: StateField<Responses>, shown: readonly Shown[]) {
  const ranges = [];
  for (const each of [...shown].sort((a, b) => a.line - b.line)) {
    const at = where.responseAt(state, each.line);
    if (at !== null) ranges.push(Decoration.widget({ widget: new ResponseWidget(each.exchange, where, field), block: true, side: 1 }).range(at));
  }
  return Decoration.set(ranges, true);
}

function responsesField(where: Where) {
  const field: StateField<Responses> = StateField.define<Responses>({
    create: () => ({ shown: [], sent: [], decorations: Decoration.none }),
    update(value, tr) {
      let { shown, sent } = value;
      if (tr.docChanged) {
        shown = shown.flatMap((each) => {
          const line = tr.changes.mapPos(each.line, -1, MapMode.TrackDel);
          return line === null ? [] : [{ ...each, line }];
        });
      }
      for (const effect of tr.effects) {
        if (effect.is(show)) {
          shown = [...shown.filter((each) => each.line !== effect.value.line), effect.value];
          sent = [...sent, effect.value.exchange].slice(-KEEP);
        } else if (effect.is(hide)) {
          shown = shown.filter((each) => each.exchange !== effect.value);
        }
      }
      if (shown === value.shown && sent === value.sent && !tr.docChanged) return value;
      return { shown, sent, decorations: shown.length ? drawResponses(tr.state, where, field, shown) : Decoration.none };
    },
    provide: (self) => EditorView.decorations.from(self, (value) => value.decorations),
  });
  return field;
}

/* Sending. */

const UNSUPPORTED = new Set(["GRAPHQL", "WEBSOCKET"]);
const LOCAL = /^(?:localhost|127\.\d+\.\d+\.\d+|\[::1\])(?::\d+)?(?:[/?#]|$)/;

/** A full address: one written without its scheme gets http:// on this computer, else https://. */
function address(url: string) {
  // Relative, with its scheme, or starting with a shell variable (copied as curl).
  if (url.startsWith("/") || url.startsWith("") || /^[a-z][\w+.-]*:\/\//i.test(url)) return url;
  return `${LOCAL.test(url) ? "http" : "https"}://${url}`;
}

/** What's wrong with sending `asked`, if anything is. */
function problem(asked: Asked, request: Request) {
  if (UNSUPPORTED.has(asked.method)) return t("http.error.unsupported", { method: asked.method });
  if (request.fileBody) return t("http.error.fileBody");
  if (request.unsupported) return t("http.error.notYet", { what: request.unsupported });
  if (asked.url.startsWith("/")) return t("http.error.relative");
  try {
    const url = new URL(asked.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return t("http.error.url");
  } catch {
    return t("http.error.url");
  }
  return null;
}

function variableProblem(error: VariableError) {
  if (error.reason === "unsent") return t("http.error.unsent", { name: error.variable });
  if (error.reason === "path") return t("http.error.path", { variable: error.variable });
  if (error.reason === "loop") return t("http.error.loop", { name: error.variable });
  if (error.reason === "locked") return t("http.error.locked", { name: error.variable });
  return t("http.error.variable", { name: error.variable });
}

const written = (request: Request): Asked => ({ method: request.method, url: request.url, headers: request.headers, body: request.body });

/** Encoded for an address or a form, but a shell variable (copied as curl), which stays as it is. */
const encode = (text: string) => (text.includes("") ? text : encodeURIComponent(text));

/** Fills in a request's variables (every one with `fill`, or what can be), and adds Hurl's query, form, cookies and user. */
function filledIn(request: Request, scope: Scope, fill: (text: string, scope: Scope) => string): Asked {
  const each = (text: string) => fill(text, scope);
  let url = address(each(request.url));
  const headers: [string, string][] = request.headers.map(([name, value]) => [each(name), each(value)]);
  let body = request.body === null ? null : each(request.body);
  const pairs = (list: [string, string][]) => list.map(([name, value]) => `${encode(each(name))}=${encode(each(value))}`).join("&");
  if (request.query?.length) url += (url.includes("?") ? "&" : "?") + pairs(request.query);
  if (request.form?.length && body === null) {
    body = pairs(request.form);
    if (!headers.some(([name]) => name.toLowerCase() === "content-type")) headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
  }
  if (request.cookies?.length) headers.push(["Cookie", request.cookies.map(([name, value]) => `${each(name)}=${each(value)}`).join("; ")]);
  if (request.bodyType && !headers.some(([name]) => name.toLowerCase() === "content-type")) headers.push(["Content-Type", request.bodyType]);
  return { method: request.method, url, headers, body, user: request.user && each(request.user) };
}

/** What Hurl entries captured, newest last, as their own types. */
function capturedIn(state: EditorState, field: StateField<Responses>) {
  const values = new Map<string, unknown>();
  for (const exchange of state.field(field).sent) for (const [name, value] of exchange.captured) values.set(name, value);
  return values;
}

/** A captured or written value, as text in a request. */
const asText = (value: unknown) => (typeof value === "string" ? value : value instanceof Date ? value.toISOString() : JSON.stringify(value));

/** What a request's `{{names}}` stand for: variables, Hurl's captures, earlier responses, and `secret`. */
function scopeOf(state: EditorState, field: StateField<Responses>, variables: Map<string, string>, secret?: Scope["secret"]): Scope {
  const { sent } = state.field(field);
  const response = (name: string) => {
    for (let i = sent.length - 1; i >= 0; i--) if (sent[i].name === name && sent[i].received) return sent[i].received!;
    return undefined;
  };
  const all = new Map(variables);
  for (const [name, value] of capturedIn(state, field)) all.set(name, asText(value));
  return { variables: all, response, secret };
}

/** The request whose line `pos` is on. */
function requestOnLine(state: EditorState, where: Where, pos: number) {
  const line = state.doc.lineAt(pos);
  return requestsIn(state, where, line.from, line.to).requests.find((request) => request.line <= pos && pos <= request.lineEnd) ?? null;
}

const say: Say = (key, params) => t(`hurl.check.${key}`, params);

/** A written variable's value as Hurl types it: a number, true, false or null, or text. */
function typed(value: string): unknown {
  if (/^(?:-?\d+(?:\.\d+)?|true|false|null)$/.test(value)) return JSON.parse(value);
  return value;
}

/** Sends the request whose line starts at `line`, and checks its response, if it's a Hurl entry. */
async function send(view: EditorView, where: Where, field: StateField<Responses>, line: number): Promise<Exchange | null> {
  const { requests, variables } = requestsIn(view.state, where);
  const request = requests.find((each) => each.line === line);
  if (!request) return null;
  let exchange: Exchange;
  // The secrets it's sent with, to show as dots.
  const used: string[] = [];
  const secret = (name: string) => {
    const value = secrets.get(name);
    if (value !== undefined) used.push(value);
    return value;
  };
  const fill = () => filledIn(request, scopeOf(view.state, field, variables, secret), fillIn);
  try {
    let asked: Asked;
    try {
      asked = fill();
    } catch (error) {
      // A name no variable has may be a secret in a locked note that's closed: open them and try again.
      if (!(error instanceof VariableError) || error.reason !== "unknown" || !secrets.closed) throw error;
      if (!(await secrets.open())) throw new VariableError("locked", error.variable);
      asked = fill();
    }
    exchange = new Exchange(asked, request.name, used);
    const wrong = problem(asked, request);
    if (wrong) exchange.fail(wrong);
  } catch (error) {
    if (!(error instanceof VariableError)) throw error;
    exchange = new Exchange(written(request), request.name);
    exchange.fail(variableProblem(error));
  }
  view.dispatch({ effects: show.of({ line, exchange }) });
  if (exchange.state === "failed") {
    speak(exchange.error);
    return exchange;
  }
  await exchange.send(request.follow ?? true);
  const { received } = exchange;
  if (received && request.expect) {
    const captured = capturedIn(view.state, field);
    const scope = scopeOf(view.state, field, variables, secret);
    exchange.checks = await check(
      request.expect,
      {
        answer: received,
        variable: (name) => exchange.captured.get(name) ?? captured.get(name) ?? (variables.has(name) ? typed(variables.get(name)!) : secrets.get(name)),
        fill: (text) => fillInWhatCan(text, scope),
        say,
      },
      exchange.captured,
    );
  }
  const failed = exchange.checks?.filter((each) => !each.ok).length ?? 0;
  const status = received ? t("http.received", { status: `${received.status} ${received.statusText}`.trim() }) : exchange.error;
  speak(failed ? `${status}. ${t("hurl.failed", { failed: String(failed), count: String(exchange.checks!.length) })}` : status);
  return exchange;
}

/**
 * Sends requests one after another, so later ones can use earlier ones' responses: those `lines()`
 * gives, found again before each, as the note can change while one is on its way. Hurl's stop at
 * the first that fails.
 */
async function sendAll(view: EditorView, where: Where, field: StateField<Responses>, lines: () => number[]) {
  for (let index = 0; ; index++) {
    const line = lines()[index];
    if (line === undefined) return;
    const exchange = await send(view, where, field, line);
    if (where.dialect.stops && exchange && !exchange.passed) return;
  }
}

/** The request lines of the block at `pos`, in a Markdown note. */
function blockLines(view: EditorView, where: Where, pos: number | null) {
  const block = pos === null ? null : fenceAt(view.state, pos);
  return block ? requestsIn(view.state, where, block.from, block.to).requests.map((request) => request.line) : [];
}

/** Headers a request with no body has no use for. */
const BODY_HEADERS = /^content-(?:type|length|encoding)$/i;

/**
 * An address in a response, as a GET request in the note after the one it came from (at the end of
 * its block, in a Markdown note), with that one's headers (its Authorization, say), then sent.
 */
async function followAddress(view: EditorView, where: Where, field: StateField<Responses>, exchange: Exchange, url: string) {
  const { state } = view;
  const from = state.field(field).shown.find((each) => each.exchange === exchange);
  const request = from && requestsIn(state, where).requests.find((each) => each.line === from.line);
  if (!request) return;
  const section = where.sections(state, request.line, request.line).find((each) => each.from <= request.line && request.line <= each.to);
  // After its last line: the blank lines before the next request stay between them.
  const at = where.markdown ? section?.to : request.to;
  if (at === undefined) return;
  const text = where.dialect.write({ method: "GET", url, headers: request.headers.filter(([name]) => !BODY_HEADERS.test(name)), body: null });
  const insert = `\n\n${where.dialect.separator}${text}`;
  const line = at + insert.indexOf(text);
  view.dispatch({ changes: { from: at, insert }, userEvent: "input" });
  await send(view, where, field, line);
}

/** Requests as curl commands, with what variables can be filled in filled in, and secrets (and other names) as shell variables. */
function curlOf(state: EditorState, where: Where, field: StateField<Responses>, requests: Request[]) {
  const scope = scopeOf(state, field, requestsIn(state, where).variables, shellVariable);
  return requests.map((request) => toCurl(filledIn(request, scope, (text, each) => fillInWhatCan(text, each)))).join("\n\n");
}

/*
 * The buttons. A code block's are in its top right corner, left of its Copy: Send, which sends each
 * of its requests in turn, and Copy as curl (Terminal's icon). In a .http or .hurl note, each
 * request's are at the end of its line.
 */

const copyAsCurl = (text: () => string, className: string) => {
  const button = copyButton(text, t("http.copyCurl"), className, "terminal");
  button.title = t("http.copyCurl");
  return button;
};

const sendIcons = new WeakMap<HTMLElement, Record<string, unknown>>();

/** A Send button, which runs `run` with itself. */
function sendButton(className: string, label: string, title: string, run: (button: HTMLButtonElement) => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.title = title;
  const icon = document.createElement("span");
  const text = document.createElement("span");
  text.textContent = label;
  button.append(icon, text);
  // Keep the click from moving the cursor.
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => run(button));
  sendIcons.set(button, mount(Icon, { target: icon, props: { name: "send", size: 12, strokeWidth: 2.25 } }));
  return button;
}

function destroySendButton(button: HTMLElement) {
  const icon = sendIcons.get(button);
  if (icon) void unmount(icon);
  sendIcons.delete(button);
}

/** Where a widget's button is in the note, while it's there. */
const placeOf = (view: EditorView, dom: HTMLElement) => (dom.isConnected ? view.posAtDOM(dom) : null);

/** Send and Copy as curl, at the end of a request's line in a .http or .hurl note. */
class RequestButtons extends WidgetType {
  constructor(
    readonly where: Where,
    readonly field: StateField<Responses>,
  ) {
    super();
  }
  eq(other: RequestButtons) {
    return other.field === this.field;
  }
  toDOM(view: EditorView) {
    const { where, field } = this;
    const dom = document.createElement("span");
    dom.className = "cm-http-actions";
    const request = () => requestOnLine(view.state, where, view.posAtDOM(dom));
    const sending = sendButton("cm-http-send", t("http.send"), `${t("http.send")} (${modKey}↵)`, () => {
      const found = request();
      if (found) void send(view, where, field, found.line);
    });
    dom.append(sending, copyAsCurl(() => curlOf(view.state, where, field, [request()].filter((each) => each !== null)), "cm-lp-copy cm-http-curl"));
    return dom;
  }
  destroy(dom: HTMLElement) {
    destroySendButton(dom.firstElementChild as HTMLElement);
    destroyCopyButton(dom.lastElementChild as HTMLElement);
  }
  ignoreEvent() {
    return true;
  }
}

/** Send and Copy as curl, in a code block's top right corner. */
class BlockButtons extends WidgetType {
  constructor(
    readonly where: Where,
    readonly field: StateField<Responses>,
    /** How many requests the block has: Send says "Send all" for more than one. */
    readonly count: number,
  ) {
    super();
  }
  eq(other: BlockButtons) {
    return other.field === this.field && other.count === this.count;
  }
  toDOM(view: EditorView) {
    const { where, field } = this;
    const dom = document.createElement("span");
    dom.className = "cm-http-block-actions";
    const all = this.count > 1;
    const title = all ? t(where.dialect.stops ? "http.sendAllStopsTitle" : "http.sendAllTitle", { key: `${modKey}↵` }) : `${t("http.send")} (${modKey}↵)`;
    const sending = sendButton("cm-http-send", all ? t("http.sendAll") : t("http.send"), title, () => {
      void sendAll(view, where, field, () => blockLines(view, where, placeOf(view, dom)));
    });
    const curl = () => {
      const block = fenceAt(view.state, view.posAtDOM(dom));
      return block ? curlOf(view.state, where, field, requestsIn(view.state, where, block.from, block.to).requests) : "";
    };
    dom.append(sending, copyAsCurl(curl, "cm-lp-copy cm-http-curl"));
    return dom;
  }
  destroy(dom: HTMLElement) {
    destroySendButton(dom.firstElementChild as HTMLElement);
    destroyCopyButton(dom.lastElementChild as HTMLElement);
  }
  ignoreEvent() {
    return true;
  }
}

function buttons(where: Where, field: StateField<Responses>) {
  const onLine = Decoration.widget({ widget: new RequestButtons(where, field), side: 1 });
  const draw = (view: EditorView) => {
    const { state } = view;
    const ranges = new Map<number, ReturnType<typeof onLine.range>>();
    for (const { from, to } of view.visibleRanges) {
      if (!where.markdown) {
        for (const request of requestsIn(state, where, from, to).requests) {
          if (request.lineEnd >= from && request.lineEnd <= to) ranges.set(request.lineEnd, onLine.range(request.lineEnd));
        }
        continue;
      }
      for (const section of where.sections(state, from, to)) {
        // At the end of the block's first line, its opening fence, after its Copy (side 1) and any Format button (side 2).
        const fence = state.doc.lineAt(Math.max(0, section.from - 1)).to;
        const count = parsed(where.dialect, state.sliceDoc(section.from, section.to)).requests.length;
        if (count && fence >= from && fence <= to) ranges.set(fence, Decoration.widget({ widget: new BlockButtons(where, field, count), side: 3 }).range(fence));
      }
    }
    return Decoration.set([...ranges.values()], true);
  };
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = draw(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || syntaxTree(update.state) !== syntaxTree(update.startState)) this.decorations = draw(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

/** Whether `pos` is in a request's text: anywhere in a .http or .hurl note, inside a block's code in a Markdown one. */
function inRequests(state: EditorState, where: Where, pos: number) {
  const line = state.doc.lineAt(pos);
  return where.sections(state, line.from, line.to).some((section) => section.from <= pos && pos <= section.to);
}

/** Sending, responses and curl for requests wherever `where` finds them. */
function requestEditing(where: Where): Extension {
  const field = responsesField(where);
  /** The request the cursor is in, and the requests of its block (or note), if it's in one. */
  const around = (view: EditorView) => {
    const pos = view.state.selection.main.head;
    if (!inRequests(view.state, where, pos)) return null;
    const all = where.markdown ? requestsIn(view.state, where, pos, pos).requests : requestsIn(view.state, where).requests;
    return { all, request: all.find((each) => each.from <= pos && pos <= each.end) ?? null };
  };
  return [
    field,
    buttons(where, field),
    Prec.high(
      keymap.of([
        {
          key: "Mod-Enter",
          run: (view) => {
            const found = around(view)?.request;
            if (!found) return false;
            void send(view, where, field, found.line);
            return true;
          },
        },
        {
          key: "Mod-Shift-Enter",
          run: (view) => {
            const found = around(view);
            if (!found?.all.length) return false;
            const pos = view.state.selection.main.head;
            void sendAll(view, where, field, () => (where.markdown ? blockLines(view, where, pos) : requestsIn(view.state, where).requests.map((each) => each.line)));
            return true;
          },
        },
      ]),
    ),
    EditorView.clipboardInputFilter.of((text, state) => {
      if (!/^\s*curl\s/.test(text) || !inRequests(state, where, state.selection.main.from)) return text;
      const command = readCurl(text);
      return command ? where.dialect.write(command.asked, command.notes) : text;
    }),
  ];
}

/** ```http and ```hurl blocks in Markdown notes. */
export const blockRequests: Extension = [requestEditing(codeBlocks(http)), requestEditing(codeBlocks(hurl))];

/** Titles (`###` ones in .http, the comment just above a Hurl entry) as a note's outline. */
const titles = (where: Where) => (state: EditorState) =>
  requestsIn(state, where)
    .requests.filter((request) => request.title)
    .map((request) => ({ level: 1, title: request.title, from: request.from }));

const noteTheme = EditorView.theme({
  ".cm-content": { fontFamily: "var(--font-mono)", fontSize: "0.9em" },
});

/** Titles stand out, as headings do in other notes. */
const noteHighlights = syntaxHighlighting(HighlightStyle.define([{ tag: tags.heading, fontWeight: "600" }]));

function noteEditing(dialect: Dialect, language: Language): Extension {
  const where = wholeNote(dialect);
  return [
    language,
    requestEditing(where),
    outlineHeadings.of(titles(where)),
    noteTheme,
    noteHighlights,
    EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
  ];
}

/** A .http note's editing: everything the blocks have, and its titles as the outline. */
export const noteRequests = noteEditing(http, httpLanguage);

/** A .hurl note's: the same, with each entry's title comment in the outline. */
export const hurlNoteRequests = noteEditing(hurl, hurlLanguage);
