import { ensureSyntaxTree, HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, MapMode, Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { mount, unmount } from "svelte";
import { speak } from "../../lib/a11y";
import { fenceAt, fenceLanguage } from "../../lib/editor/rendered";
import { outlineHeadings } from "../../lib/editor/outline.svelte";
import Icon from "../../lib/icons/Icon.svelte";
import type { IconName } from "../../lib/icons/icons";
import { t } from "../../lib/i18n/index.svelte";
import { copyText, modKey } from "../../lib/platform";
import { type Asked, fromCurl, toCurl } from "./curl";
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
  ) {
    super();
  }
  eq(other: ResponseWidget) {
    return other.exchange === this.exchange;
  }
  toDOM(view: EditorView) {
    const dom = document.createElement("div");
    dom.className = "cm-http-response";
    const { exchange, where } = this;
    const close = () => view.dispatch({ effects: hide.of(exchange) });
    const addToNote = where.markdown && !view.state.readOnly ? (text: string, language: string) => writeIntoNote(view, dom, exchange, text, language) : undefined;
    const component = mount(Response, { target: dom, props: { exchange, close, addToNote } });
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

function drawResponses(state: EditorState, where: Where, shown: readonly Shown[]) {
  const ranges = [];
  for (const each of [...shown].sort((a, b) => a.line - b.line)) {
    const at = where.responseAt(state, each.line);
    if (at !== null) ranges.push(Decoration.widget({ widget: new ResponseWidget(each.exchange, where), block: true, side: 1 }).range(at));
  }
  return Decoration.set(ranges, true);
}

const responsesField = (where: Where) =>
  StateField.define<Responses>({
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
      return { shown, sent, decorations: shown.length ? drawResponses(tr.state, where, shown) : Decoration.none };
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  });

/* Sending. */

const UNSUPPORTED = new Set(["GRAPHQL", "WEBSOCKET"]);
const LOCAL = /^(?:localhost|127\.\d+\.\d+\.\d+|\[::1\])(?::\d+)?(?:[/?#]|$)/;

/** A full address: one written without its scheme gets http:// on this computer, else https://. */
function address(url: string) {
  if (url.startsWith("/") || /^[a-z][\w+.-]*:\/\//i.test(url)) return url;
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

function scopeOf(state: EditorState, field: StateField<Responses>, variables: Map<string, string>): Scope {
  const { sent } = state.field(field);
  const response = (name: string) => {
    for (let i = sent.length - 1; i >= 0; i--) if (sent[i].name === name && sent[i].received) return sent[i].received!;
    return undefined;
  };
  return { variables, response };
}

/** The request whose line `pos` is on. */
function requestOnLine(state: EditorState, where: Where, pos: number) {
  const line = state.doc.lineAt(pos);
  return requestsIn(state, where, line.from, line.to).requests.find((request) => request.line <= pos && pos <= request.lineEnd) ?? null;
}

function send(view: EditorView, where: Where, field: StateField<Responses>, line: number) {
  const { state } = view;
  const { requests, variables } = requestsIn(state, where);
  const request = requests.find((each) => each.line === line);
  if (!request) return;
  let exchange: Exchange;
  try {
    const asked = filledIn(request, scopeOf(state, field, variables), fillIn);
    exchange = new Exchange(asked, request.name);
    const wrong = problem(asked, request);
    if (wrong) exchange.fail(wrong);
  } catch (error) {
    if (!(error instanceof VariableError)) throw error;
    exchange = new Exchange(written(request), request.name);
    exchange.fail(variableProblem(error));
  }
  view.dispatch({ effects: show.of({ line, exchange }) });
  if (exchange.state === "failed") return speak(exchange.error);
  void exchange.send().then(() => {
    const { received } = exchange;
    speak(received ? t("http.received", { status: `${received.status} ${received.statusText}`.trim() }) : exchange.error);
  });
}

/** A request as a curl command, with what variables can be filled in filled in. */
function curlOf(state: EditorState, where: Where, field: StateField<Responses>, pos: number) {
  const request = requestOnLine(state, where, pos);
  if (!request) return "";
  const { variables } = requestsIn(state, where);
  return toCurl(filledIn(request, scopeOf(state, field, variables), (text, scope) => fillInWhatCan(text, scope)));
}

/* The buttons on each request's line. */

const icons = new WeakMap<HTMLElement, Record<string, unknown>[]>();

/** A small button on a request's line: an icon and a word. */
function lineButton(className: string, word: string, icon: IconName, run: (button: HTMLButtonElement) => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  const spot = document.createElement("span");
  spot.className = "cm-http-icon";
  const text = document.createElement("span");
  text.textContent = word;
  button.append(spot, text);
  // Keep the click from moving the cursor.
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => run(button));
  return { button, icon: mount(Icon, { target: spot, props: { name: icon, size: 12, strokeWidth: 2.25 } }) };
}

/** Send, and curl: the request as a curl command, copied (a check shows for a moment). */
class SendWidget extends WidgetType {
  constructor(
    readonly where: Where,
    readonly field: StateField<Responses>,
  ) {
    super();
  }
  eq(other: SendWidget) {
    return other.where === this.where;
  }
  toDOM(view: EditorView) {
    const { where, field } = this;
    const dom = document.createElement("span");
    dom.className = "cm-http-actions";
    const sending = lineButton("cm-http-send", t("http.send"), "send", () => {
      const request = requestOnLine(view.state, where, view.posAtDOM(dom));
      if (request) send(view, where, field, request.line);
    });
    sending.button.title = `${t("http.send")} (${modKey}↵)`;
    let copied: ReturnType<typeof setTimeout> | undefined;
    const curl = lineButton("cm-http-curl", "curl", "check", (button) => {
      void copyText(curlOf(view.state, where, field, view.posAtDOM(dom)));
      speak(t("editor.copied"));
      button.classList.add("is-copied");
      clearTimeout(copied);
      copied = setTimeout(() => button.classList.remove("is-copied"), 1200);
    });
    curl.button.title = t("http.copyCurl");
    curl.button.setAttribute("aria-label", t("http.copyCurl"));
    dom.append(sending.button, curl.button);
    icons.set(dom, [sending.icon, curl.icon]);
    return dom;
  }
  destroy(dom: HTMLElement) {
    for (const icon of icons.get(dom) ?? []) void unmount(icon);
    icons.delete(dom);
  }
  ignoreEvent() {
    return true;
  }
}

function sendButtons(where: Where, field: StateField<Responses>) {
  const widget = Decoration.widget({ widget: new SendWidget(where, field), side: 1 });
  const draw = (view: EditorView) => {
    const ends = new Set<number>();
    for (const { from, to } of view.visibleRanges) {
      for (const request of requestsIn(view.state, where, from, to).requests) {
        if (request.lineEnd >= from && request.lineEnd <= to) ends.add(request.lineEnd);
      }
    }
    return Decoration.set([...ends].map((end) => widget.range(end)), true);
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
    sendButtons(where, field),
    Prec.high(
      keymap.of([
        {
          key: "Mod-Enter",
          run: (view) => {
            const pos = view.state.selection.main.head;
            if (!inRequests(view.state, where, pos)) return false;
            const request = requestsIn(view.state, where, pos, pos).requests.find((each) => each.from <= pos && pos <= each.end);
            if (!request) return false;
            send(view, where, field, request.line);
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

