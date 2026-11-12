<script lang="ts">
  // A color: a swatch that opens the system's color picker, and the color as text, to type or paste
  // (any color CSS reads). An optional one can be left empty, to follow from others ("Auto").
  import type { HTMLAttributes } from "svelte/elements";
  import { t } from "../../i18n/index.svelte";
  import { hex, parse } from "../../themes/color";
  import { isColor } from "../../themes/file";
  import IconButton from "./IconButton.svelte";
  import TextField from "./TextField.svelte";

  type Props = {
    /** What the color is for, as its row says it. */
    label: string;
    value: string | undefined;
    /** The text field's id, for its row's label. */
    id?: string;
    /** What the swatch shows: `value` unless it's a CSS variable that works the color out when there's none. */
    swatch?: string;
    /** Attributes for the swatch's frame, such as the custom properties `swatch` reads. */
    frame?: HTMLAttributes<HTMLSpanElement>;
    optional?: boolean;
    /** What the empty field shows: "Auto" unless said. */
    placeholder?: string;
    onchange: (value: string | undefined) => void;
  };
  let { label, value, id, swatch, frame, optional = false, placeholder, onchange }: Props = $props();

  /** What's typed, while it's being typed: it only becomes the color once it is one. */
  let draft = $state<string | null>(null);
  let shown = $state<HTMLSpanElement>();
  let picker = $state<HTMLInputElement>();

  const invalid = $derived(draft !== null && draft.trim() !== "" && !isColor(draft.trim()));

  function typed(text: string) {
    draft = text;
    const color = text.trim();
    if (isColor(color)) onchange(color);
    else if (!color && optional) onchange(undefined);
  }

  /** The picker starts from the color shown, worked out by the browser when it isn't hex already. */
  function startPicker() {
    const color = parse(value) ?? (shown && parse(getComputedStyle(shown).backgroundColor));
    if (picker && color) picker.value = hex(color);
  }
</script>

<div class="flex items-center gap-2">
  <!-- The picker is see-through over the swatch, which shows its focus. -->
  <span class="relative grid size-8 shrink-0 place-items-center rounded-lg has-focus-visible:outline-2 has-focus-visible:outline-accent">
    <span {...frame} class={["contents", frame?.class]} aria-hidden="true">
      <span bind:this={shown} class="size-7 rounded-md inset-ring inset-ring-line forced-color-adjust-none" style:background={swatch ?? value}></span>
    </span>
    <input
      bind:this={picker}
      type="color"
      aria-label={t("settings.colorPick", { name: label })}
      class="absolute inset-0 size-full cursor-pointer opacity-0"
      onfocus={startPicker}
      onpointerdown={startPicker}
      oninput={(event) => {
        draft = null;
        onchange(event.currentTarget.value);
      }}
    />
  </span>
  <TextField
    {id}
    value={draft ?? value ?? ""}
    placeholder={placeholder ?? (optional ? t("settings.colorAuto") : undefined)}
    aria-invalid={invalid}
    spellcheck="false"
    autocomplete="off"
    class="w-36 font-mono"
    oninput={(event) => typed(event.currentTarget.value)}
    onblur={() => (draft = null)}
  />
  <!-- Hidden but there for colors that can't be automatic, so every row's swatch lines up. -->
  <IconButton
    icon="restore"
    label={t("settings.colorReset", { name: label })}
    iconSize={15}
    class={optional ? "" : "invisible"}
    disabled={value === undefined}
    onclick={() => onchange(undefined)}
  />
</div>
