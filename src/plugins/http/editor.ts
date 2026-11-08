import { ensureSyntaxTree, HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, MapMode, Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { mount, unmount } from "svelte";
import { speak } from "../../lib/a11y";
import { fenceAt, fenceLanguage } from "../../lib/editor/rendered";
import { copyButton, destroyCopyButton } from "../../lib/editor/keyValue";
import { outlineHeadings } from "../../lib/editor/outline.svelte";
import Icon from "../../lib/icons/Icon.svelte";
import { t } from "../../lib/i18n/index.svelte";
import { secrets } from "../../lib/notes/secrets.svelte";
import { modKey } from "../../lib/platform";
import { type Asked, fromCurl, shellVariable, toCurl } from "./curl";
import { httpLanguage } from "./language";
import { type HttpRequest, type HttpText, parseHttp } from "./parse";
import Response from "./Response.svelte";
import { Exchange } from "./send.svelte";
import { fillIn, fillInWhatCan, type Scope, VariableError } from "./variables";

/*
 * Sending requests from a note: a Send button at the end of each request line (and ⌘↵ in a
 * request), the response under it, Copy as curl, and curl commands pasted into a request written
 * as one. In .http notes the whole note is requests; in Markdown notes, each ```http block is.
 * Responses last until lines quits, for the requests after them to use (`{{login.response…}}`).
 */

/** Where a note's requests are. */
interface Where {
  /** The stretches of .http text between `from` and `to`. */
  sections(state: EditorState, from: number, to: number): { from: number; to: number }[];
  /** Where the response to the request whose line starts at `line` goes, if it's still there. */
  responseAt(state: EditorState, line: number): number | null;
  /** Whether a response can be written into the note as a code block. */
  markdown: boolean;
}

/** Requests read from .http text, by the text, so drawing again doesn't read it again. */
const read = new Map<string, HttpText>();

function parsed(text: string) {
  let found = read.get(text);
  if (!found) {
    if (read.size >= 64) read.delete(read.keys().next().value!);
    read.set(text, (found = parseHttp(text)));
  }
  return found;
}

/** The requests between `from` and `to`, where they are in the note, and the variables written there. */
function requestsIn(state: EditorState, where: Where, from = 0, to = state.doc.length) {
  const requests: HttpRequest[] = [];
  const variables = new Map<string, string>();
  for (const section of where.sections(state, from, to)) {
    const text = parsed(state.sliceDoc(section.from, section.to));
    const at = (pos: number) => pos + section.from;
    for (const request of text.requests) {
      requests.push({ ...request, from: at(request.from), line: at(request.line), lineEnd: at(request.lineEnd), to: at(request.to), end: at(request.end) });
    }
    for (const [name, value] of text.variables) variables.set(name, value);
  }
  return { requests, variables };
}

const HTTP_BLOCK = /^(?:http|rest)$/;

/** Blocks a code block can't be inside, which aren't looked through. */
const NO_CODE = new Set(["Paragraph", "ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6", "SetextHeading1", "SetextHeading2", "Table", "HTMLBlock", "CodeBlock", "CommentBlock", "LinkReference", "HorizontalRule"]);

/** All of a .http note. */
const wholeNote: Where = {
  sections: (state) => [{ from: 0, to: state.doc.length }],
  responseAt: (state, line) => requestsIn(state, wholeNote).requests.find((request) => request.line === line)?.to ?? null,
  markdown: false,
};

/** The code of each ```http block in a Markdown note. */
const httpBlocks: Where = {
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
        if (info && code && HTTP_BLOCK.test(fenceLanguage(state.sliceDoc(info.from, info.to)))) found.push({ from: code.from, to: code.to });
        return false;
      },
    });
    return found;
  },
  responseAt(state, line) {
    const block = fenceAt(state, line);
    if (!block || !httpBlocks.sections(state, block.from, block.to).length) return null;
    return state.doc.lineAt(block.to).to;
  },
  markdown: true,
};

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
  const fence = "`".repeat(Math.max(3, ...[...text.matchAll(/`{3,}/g)].map((match) => match[0].length + 1)));
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
  if (url.startsWith("/") || url.startsWith("\uE000") || /^[a-z][\w+.-]*:\/\//i.test(url)) return url;
  return `${LOCAL.test(url) ? "http" : "https"}://${url}`;
}

/** What's wrong with sending `asked`, if anything is. */
function problem(asked: Asked, request: HttpRequest) {
  if (UNSUPPORTED.has(asked.method)) return t("http.error.unsupported", { method: asked.method });
  if (request.fileBody) return t("http.error.fileBody");
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

const written = (request: HttpRequest): Asked => ({ method: request.method, url: request.url, headers: request.headers, body: request.body });

/** Fills in a request's variables: every one (`fill`), or what can be. */
function filledIn(request: HttpRequest, scope: Scope, fill: (text: string, scope: Scope) => string): Asked {
  return {
    method: request.method,
    url: address(fill(request.url, scope)),
    headers: request.headers.map(([name, value]) => [fill(name, scope), fill(value, scope)]),
    body: request.body === null ? null : fill(request.body, scope),
  };
}

/** What a request's `{{names}}` stand for: variables, earlier responses, and `secret`. */
function scopeOf(state: EditorState, field: StateField<Responses>, variables: Map<string, string>, secret?: Scope["secret"]): Scope {
  const { sent } = state.field(field);
  const response = (name: string) => {
    for (let i = sent.length - 1; i >= 0; i--) if (sent[i].name === name && sent[i].received) return sent[i].received!;
    return undefined;
  };
  return { variables, response, secret };
}

/** The request whose line `pos` is on. */
function requestOnLine(state: EditorState, where: Where, pos: number) {
  const line = state.doc.lineAt(pos);
  return requestsIn(state, where, line.from, line.to).requests.find((request) => request.line <= pos && pos <= request.lineEnd) ?? null;
}

async function send(view: EditorView, where: Where, field: StateField<Responses>, line: number) {
  const { state } = view;
  const { requests, variables } = requestsIn(state, where);
  const request = requests.find((each) => each.line === line);
  if (!request) return;
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
  if (exchange.state === "failed") return speak(exchange.error);
  await exchange.send();
  const { received } = exchange;
  speak(received ? t("http.received", { status: `${received.status} ${received.statusText}`.trim() }) : exchange.error);
}

/** Each request in the ```http block at `at()`, one after another, so later ones can use earlier ones' responses. */
async function sendBlock(view: EditorView, field: StateField<Responses>, at: () => number | null) {
  for (let index = 0; ; index++) {
    // Found again each time: the note can change while one is on its way.
    const pos = at();
    const block = pos === null ? null : fenceAt(view.state, pos);
    const requests = block ? requestsIn(view.state, httpBlocks, block.from, block.to).requests : [];
    if (index >= requests.length) return;
    await send(view, httpBlocks, field, requests[index].line);
  }
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
  const lines = ["###", `GET ${url}`, ...request.headers.filter(([name]) => !BODY_HEADERS.test(name)).map(([name, value]) => `${name}: ${value}`)];
  const insert = `\n\n${lines.join("\n")}`;
  const line = at + insert.indexOf("GET ");
  view.dispatch({ changes: { from: at, insert }, userEvent: "input" });
  await send(view, where, field, line);
}

/** A request as a curl command, with what variables can be filled in filled in, and secrets (and other names) as shell variables. */
function curlOf(state: EditorState, where: Where, field: StateField<Responses>, pos: number) {
  const request = requestOnLine(state, where, pos);
  if (!request) return "";
  const { variables } = requestsIn(state, where);
  return toCurl(filledIn(request, scopeOf(state, field, variables, shellVariable), (text, scope) => fillInWhatCan(text, scope)));
}

/** Every request in the ```http block at `pos`, as curl commands. */
function blockCurl(state: EditorState, field: StateField<Responses>, pos: number) {
  const block = fenceAt(state, pos);
  if (!block) return "";
  const scope = scopeOf(state, field, requestsIn(state, httpBlocks).variables, shellVariable);
  return requestsIn(state, httpBlocks, block.from, block.to)
    .requests.map((request) => toCurl(filledIn(request, scope, (text, each) => fillInWhatCan(text, each))))
    .join("\n\n");
}

/*
 * The buttons. An http block's are in its top right corner, left of its Copy: Send, which sends
 * each of its requests in turn, and Copy as curl (Terminal's icon). In a .http note, each request's
 * are at the end of its line.
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

/** Send and Copy as curl, at the end of a request's line in a .http note. */
class RequestButtons extends WidgetType {
  constructor(readonly field: StateField<Responses>) {
    super();
  }
  eq(other: RequestButtons) {
    return other.field === this.field;
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("span");
    dom.className = "cm-http-actions";
    const sending = sendButton("cm-http-send", t("http.send"), `${t("http.send")} (${modKey}↵)`, () => {
      const request = requestOnLine(view.state, wholeNote, view.posAtDOM(dom));
      if (request) void send(view, wholeNote, this.field, request.line);
    });
    dom.append(sending, copyAsCurl(() => curlOf(view.state, wholeNote, this.field, view.posAtDOM(dom)), "cm-lp-copy cm-http-curl"));
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

/** Send and Copy as curl, in an http block's top right corner. */
class BlockButtons extends WidgetType {
  constructor(
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
    const dom = document.createElement("span");
    dom.className = "cm-http-block-actions";
    const all = this.count > 1;
    const sending = sendButton("cm-http-send", all ? t("http.sendAll") : t("http.send"), all ? t("http.sendAllTitle", { key: `${modKey}↵` }) : `${t("http.send")} (${modKey}↵)`, () => {
      void sendBlock(view, this.field, () => placeOf(view, dom));
    });
    dom.append(sending, copyAsCurl(() => blockCurl(view.state, this.field, view.posAtDOM(dom)), "cm-lp-copy cm-http-curl"));
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
  const onLine = Decoration.widget({ widget: new RequestButtons(field), side: 1 });
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
        const count = parsed(state.sliceDoc(section.from, section.to)).requests.length;
        if (count && fence >= from && fence <= to) ranges.set(fence, Decoration.widget({ widget: new BlockButtons(field, count), side: 3 }).range(fence));
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

/** Whether `pos` is in a request's text: anywhere in a .http note, inside a ```http block's code in a Markdown one. */
function inRequests(state: EditorState, where: Where, pos: number) {
  const line = state.doc.lineAt(pos);
  return where.sections(state, line.from, line.to).some((section) => section.from <= pos && pos <= section.to);
}

/** Sending, responses and curl for requests wherever `where` finds them. */
function requestEditing(where: Where): Extension {
  const field = responsesField(where);
  return [
    field,
    buttons(where, field),
    Prec.high(
      keymap.of([
        {
          key: "Mod-Enter",
          run: (view) => {
            const pos = view.state.selection.main.head;
            if (!inRequests(view.state, where, pos)) return false;
            const request = requestsIn(view.state, where, pos, pos).requests.find((each) => each.from <= pos && pos <= each.end);
            if (!request) return false;
            void send(view, where, field, request.line);
            return true;
          },
        },
      ]),
    ),
    EditorView.clipboardInputFilter.of((text, state) => {
      if (!/^\s*curl\s/.test(text) || !inRequests(state, where, state.selection.main.from)) return text;
      return fromCurl(text) ?? text;
    }),
  ];
}

/** ```http blocks in Markdown notes. */
export const blockRequests = requestEditing(httpBlocks);

/** The `###` titles, as a .http note's outline. */
function titles(state: EditorState) {
  return requestsIn(state, wholeNote)
    .requests.filter((request) => request.title)
    .map((request) => ({ level: 1, title: request.title, from: request.from }));
}

const noteTheme = EditorView.theme({
  ".cm-content": { fontFamily: "var(--font-mono)", fontSize: "0.9em" },
});

/** Titles stand out, as headings do in other notes. */
const noteHighlights = syntaxHighlighting(HighlightStyle.define([{ tag: tags.heading, fontWeight: "600" }]));

/** A .http note's editing: everything the blocks have, and its titles as the outline. */
export const noteRequests: Extension = [
  httpLanguage,
  requestEditing(wholeNote),
  outlineHeadings.of(titles),
  noteTheme,
  noteHighlights,
  EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
];

