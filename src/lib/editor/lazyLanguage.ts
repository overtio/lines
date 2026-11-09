import type { LanguageDescription } from "@codemirror/language";
import { Compartment, type Extension } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";

/** A language of @codemirror/language-data, its parser and highlighting, loaded the first time an editor has it. */
export function lazyLanguage(description: LanguageDescription): Extension {
  const syntax = new Compartment();
  const loading = description.support
    ? []
    : ViewPlugin.define((view) => {
        let open = true;
        void description.load().then((support) => {
          if (open) view.dispatch({ effects: syntax.reconfigure(support) });
        });
        return { destroy: () => (open = false) };
      });
  return [syntax.of(description.support ?? []), loading];
}
