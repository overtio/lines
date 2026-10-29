import { WidgetType } from "@codemirror/view";
import { mount, unmount } from "svelte";
import Icon from "../icons/Icon.svelte";
import { copyText } from "../platform";

/*
 * "Key: Value" lines, like `**Plate:** 3WBZ56` or `Driver License: SA4550143`. Hovering the
 * value shows a copy button after it. Code blocks and table cells use the same button.
 */

/**
 * A short key (optionally bold), a colon and a space, then the value. The space keeps out
 * times (10:30) and links (https://…).
 */
const KEY_VALUE = /^(?:\*\*|__)?[\p{L}\p{N}][^:*_`\n]{0,39}?(?:\*\*|__)?:(?:\*\*|__)?[ \t]+(\S.*?)\s*$/du;

/** Where the value is in `text`, if it's a "Key: Value" line. */
export function keyValue(text: string): { from: number; to: number } | null {
  const match = KEY_VALUE.exec(text);
  if (!match?.indices?.[1]) return null;
  const [from, to] = match.indices[1];
  return { from, to };
}

const mounted = new WeakMap<HTMLElement, Record<string, unknown>[]>();

/** A copy button. `text` gives what it copies, when it's clicked. */
export function copyButton(text: () => string, label: string, className = "cm-lp-copy") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.title = "Copy";
  button.setAttribute("aria-label", label);
  // Both icons stay mounted; a copy swaps which one shows for a moment.
  const icons = (["copy", "check"] as const).map((name) => {
    const target = document.createElement("span");
    target.className = `cm-lp-copy-${name}`;
    button.append(target);
    return mount(Icon, { target, props: { name, size: 14, strokeWidth: 2 } });
  });
  let done: ReturnType<typeof setTimeout> | undefined;
  // Keep the click from moving the cursor (and the editor from taking focus).
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    void copyText(text());
    button.classList.add("is-copied");
    clearTimeout(done);
    done = setTimeout(() => button.classList.remove("is-copied"), 1200);
  });
  mounted.set(button, icons);
  return button;
}

/** Unmounts a `copyButton`'s icons. */
export function destroyCopyButton(button: HTMLElement) {
  for (const icon of mounted.get(button) ?? []) void unmount(icon);
  mounted.delete(button);
}

/** What each CopyWidget's button copies; updated in place as the text is edited. */
const copies = new WeakMap<HTMLElement, string>();

/** A button that copies `text` exactly. */
export class CopyWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly label: string,
    readonly className = "cm-lp-copy",
  ) {
    super();
  }
  eq(other: CopyWidget) {
    return other.text === this.text && other.label === this.label && other.className === this.className;
  }
  toDOM() {
    const button = copyButton(() => copies.get(button) ?? "", this.label, this.className);
    copies.set(button, this.text);
    return button;
  }
  // Typing in the code or value keeps the same button, rather than remounting it each keystroke.
  updateDOM(dom: HTMLElement) {
    if (!this.className.split(" ").every((name) => dom.classList.contains(name))) return false;
    copies.set(dom, this.text);
    dom.setAttribute("aria-label", this.label);
    return true;
  }
  destroy(dom: HTMLElement) {
    destroyCopyButton(dom);
  }
  ignoreEvent() {
    return true;
  }
}
