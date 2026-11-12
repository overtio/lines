<script lang="ts">
  // Settings → Cursor: the text cursor's shape, color, blink, how it moves and what it does as you
  // type, tried in a little editor at the top; and the pointer, and what follows it about.
  import { EditorState } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { createExtensions } from "../../editor/setup";
  import { type MessageKey, t } from "../../i18n/index.svelte";
  import { CARET_BLINKS, CARET_COLORS, CARET_EFFECTS, CARET_MOTIONS, CARET_SHAPES, CARET_WIDTHS, POINTER_STYLES, POINTER_TRAILS, prefs } from "../../prefs.svelte";
  import ColorField from "../ui/ColorField.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";

  const NAMES: Record<string, MessageKey> = {
    bar: "settings.caretBar",
    thick: "settings.caretThick",
    block: "settings.caretBlock",
    underline: "settings.caretUnderline",
    letter: "settings.caretWidthLetter",
    even: "settings.caretWidthEven",
    accent: "settings.color.accent",
    text: "settings.headingColorText",
    custom: "settings.paperColorCustom",
    steps: "settings.caretBlinkSteps",
    smooth: "settings.caretBlinkSmooth",
    off: "settings.caretBlinkOff",
    jump: "settings.caretJump",
    glide: "settings.caretGlide",
    trail: "settings.caretTrail",
    none: "settings.caretNone",
    glow: "settings.caretGlow",
    rainbow: "settings.caretRainbow",
    sparks: "settings.caretSparks",
    system: "settings.pointerSystem",
    retro: "settings.pointerRetro",
    dot: "settings.pointerDot",
    comet: "settings.pointerComet",
    sparkles: "settings.pointerSparkles",
  };
  const options = <T extends string>(ids: readonly T[]) => ids.map((id) => ({ id, label: t(NAMES[id]) }));
  const swatches = $derived<Record<string, string>>({ accent: "var(--accent)", text: "var(--text)", custom: prefs.caretCustomColor });

  let host: HTMLDivElement;

  // A note to try the cursor in, as notes have it; nothing typed here is kept.
  $effect(() => {
    const view = new EditorView({ parent: host, state: EditorState.create({ doc: t("settings.caretSample"), extensions: createExtensions(() => {}) }) });
    return () => view.destroy();
  });
</script>

<div
  class="h-[120px] overflow-hidden rounded-xl border border-card-line bg-bg [--editor-pad-top:14px] [--editor-pad-x:20px] [--editor-width:none] [&_.cm-content]:pb-4! [&_.cm-editor]:h-full"
  bind:this={host}
  aria-label={t("settings.caretTry")}
  role="group"
></div>

<FieldGroup title={t("settings.caret")} note={t("settings.caretNote")}>
  <FieldRow label={t("settings.caretShape")}>
    <Segmented label={t("settings.caretShape")} options={options(CARET_SHAPES)} value={prefs.caretShape} onselect={(id) => (prefs.caretShape = id)} />
  </FieldRow>
  {#if prefs.caretShape === "block" || prefs.caretShape === "underline"}
    <FieldRow label={t("settings.caretWidth")} note={t("settings.caretWidthNote")}>
      <Segmented label={t("settings.caretWidth")} options={options(CARET_WIDTHS)} value={prefs.caretWidth} onselect={(id) => (prefs.caretWidth = id)} />
    </FieldRow>
  {/if}
  <FieldRow label={t("settings.caretColor")}>
    <Segmented label={t("settings.caretColor")} options={options(CARET_COLORS)} value={prefs.caretColor} onselect={(id) => (prefs.caretColor = id)}>
      {#snippet content(option)}
        <span class="size-2.5 shrink-0 rounded-full inset-ring inset-ring-line" style:background={swatches[option.id]} aria-hidden="true"></span>
        {option.label}
      {/snippet}
    </Segmented>
  </FieldRow>
  {#if prefs.caretColor === "custom"}
    <FieldRow label={t("settings.paperCustomColor")} for="caret-custom-color">
      <ColorField id="caret-custom-color" label={t("settings.paperCustomColor")} value={prefs.caretCustomColor} onchange={(color) => color && (prefs.caretCustomColor = color)} />
    </FieldRow>
  {/if}
  <FieldRow label={t("settings.caretBlink")}>
    <Segmented label={t("settings.caretBlink")} options={options(CARET_BLINKS)} value={prefs.caretBlink} onselect={(id) => (prefs.caretBlink = id)} />
  </FieldRow>
  <FieldRow label={t("settings.caretMotion")} note={t("settings.caretMotionNote")}>
    <Segmented label={t("settings.caretMotion")} options={options(CARET_MOTIONS)} value={prefs.caretMotion} onselect={(id) => (prefs.caretMotion = id)} />
  </FieldRow>
  <FieldRow label={t("settings.caretEffect")} note={t("settings.caretEffectNote")}>
    <Segmented label={t("settings.caretEffect")} options={options(CARET_EFFECTS)} value={prefs.caretEffect} onselect={(id) => (prefs.caretEffect = id)} />
  </FieldRow>
</FieldGroup>

<FieldGroup title={t("settings.pointer")} note={t("settings.pointerNote")}>
  <FieldRow label={t("settings.pointerStyle")}>
    <Segmented label={t("settings.pointerStyle")} options={options(POINTER_STYLES)} value={prefs.pointerStyle} onselect={(id) => (prefs.pointerStyle = id)} />
  </FieldRow>
  <FieldRow label={t("settings.pointerTrail")}>
    <Segmented label={t("settings.pointerTrail")} options={options(POINTER_TRAILS)} value={prefs.pointerTrail} onselect={(id) => (prefs.pointerTrail = id)} />
  </FieldRow>
</FieldGroup>

<p class="m-0 px-1 text-xs leading-normal text-muted">{t("settings.motionNote")}</p>
