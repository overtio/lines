<script lang="ts">
  // A color as text, to type or paste: any color CSS reads. What's typed only becomes the color once
  // it is one, and an optional color can be emptied, to follow from others ("Auto").
  import type { HTMLInputAttributes } from "svelte/elements";
  import { t } from "../../i18n/index.svelte";
  import { isColor } from "../../themes/file";
  import TextField from "./TextField.svelte";

  type Props = Omit<HTMLInputAttributes, "value" | "onchange"> & {
    value: string | undefined;
    optional?: boolean;
    onchange: (value: string | undefined) => void;
  };
  let { value, optional = false, placeholder, onchange, class: className, ...rest }: Props = $props();

  /** What's typed, while it's being typed. */
  let draft = $state<string | null>(null);
  const invalid = $derived(draft !== null && draft.trim() !== "" && !isColor(draft.trim()));

  function typed(text: string) {
    draft = text;
    const color = text.trim();
    if (isColor(color)) onchange(color);
    else if (!color && optional) onchange(undefined);
  }
</script>

<TextField
  {...rest}
  value={draft ?? value ?? ""}
  placeholder={placeholder ?? (optional ? t("settings.colorAuto") : undefined)}
  aria-invalid={invalid}
  spellcheck="false"
  autocomplete="off"
  class={["font-mono", className]}
  oninput={(event) => typed(event.currentTarget.value)}
  onblur={() => (draft = null)}
/>
