<script lang="ts">
  // A theme's colors, for light and dark, with a preview: what each part is drawn in, one of its
  // palette's colors or worked out (Auto), and the palette each scheme is drawn in. One of yours
  // can be renamed, drawn in another palette, given the scheme it lacks, shared as a file and
  // deleted; one of lines' own shows what it's made of, to make your own from.
  import { onMount, tick } from "svelte";
  import { speak } from "../../a11y";
  import { PALETTE } from "../../palette";
  import { t } from "../../i18n/index.svelte";
  import { fileName } from "../../notes/fileName";
  import { reducedMotion } from "../../platform";
  import { plugins } from "../../plugins/registry.svelte";
  import { prefs } from "../../prefs.svelte";
  import { luminance, parse } from "../../themes/color";
  import { customThemes } from "../../themes/custom.svelte";
  import { SCHEMES, THEME_FILE_EXTENSION, writeThemeFile } from "../../themes/file";
  import { FORMATTING_COLORS } from "../../themes/formatting";
  import { paletteNames } from "../../themes/names";
  import { assigned, otherScheme, paletteOf, resolveTheme, type Scheme } from "../../themes/palette";
  import { paletteChoices, swatchesOf } from "../../themes/paletteSwatches";
  import Button from "../ui/Button.svelte";
  import CardBlock from "./CardBlock.svelte";
  import { colorName } from "./colorNames";
  import ColorField from "../ui/ColorField.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import PaletteStrip from "./PaletteStrip.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Select from "../ui/Select.svelte";
  import TextField from "../ui/TextField.svelte";
  import ShareFileMenu from "./ShareFileMenu.svelte";
  import ThemePreview from "./ThemePreview.svelte";

  /** `fresh`: just made, so its name is selected, to type over. `oncopy` makes one of yours from it. */
  let { id, fresh = false, ondelete, oncopy }: { id: string; fresh?: boolean; ondelete: () => void; oncopy: () => void } = $props();
  const uid = $props.id();
  let nameField = $state<HTMLInputElement>();
  onMount(() => {
    if (!fresh || !nameField) return;
    nameField.focus({ preventScroll: true });
    nameField.select();
    nameField.scrollIntoView({ block: "center", behavior: reducedMotion.matches ? "instant" : "smooth" });
  });

  type Color = { key: string; label: string; note?: string };
  const color = (key: string, note?: string): Color => ({ key, label: colorName(key), note });
  const GROUPS: { title: string; note?: string; colors: Color[]; more?: boolean }[] = [
    {
      title: t("settings.themeBackgrounds"),
      colors: [
        color("bg"),
        color("bg-list"),
        color("bg-sidebar"),
        color("bg-elevated"),
      ],
    },
    {
      title: t("settings.themeText"),
      colors: [
        color("text"),
        color("text-sidebar"),
        color("text-muted", t("settings.color.textMutedNote")),
        color("text-faint", t("settings.color.textFaintNote")),
      ],
    },
    {
      title: t("settings.themeAccent"),
      colors: [
        color("accent", t("settings.color.accentNote")),
        color("tag-text"),
        color("ink", t("settings.color.inkNote")),
      ],
    },
    {
      title: t("settings.themeStatus"),
      more: true,
      colors: [
        color("danger", t("settings.color.dangerNote")),
        color("success"),
        color("pin"),
        color("highlight-base"),
      ],
    },
    {
      title: t("settings.themeCallouts"),
      more: true,
      colors: [
        color("callout-info"),
        color("callout-question"),
        color("callout-warning"),
        color("callout-error"),
        color("callout-decision"),
      ],
    },
    {
      title: t("settings.themePalette"),
      more: true,
      colors: PALETTE.filter((each) => each !== "accent").map((each) => color(`palette-${each}`)),
    },
    {
      title: t("settings.themeFormatting"),
      note: t("settings.themeFormattingNote"),
      more: true,
      colors: FORMATTING_COLORS.map((key) => color(key)),
    },
    {
      title: t("settings.themeCode"),
      more: true,
      colors: [
        color("syn-keyword"),
        color("syn-string"),
        color("syn-number"),
        color("syn-comment"),
        color("syn-function"),
        color("syn-type"),
      ],
    },
  ];
  /** What every theme has; the rest can be left for lines to work out from these (Auto). */
  const needed = new Set(["bg", "text"]);
  const schemeOptions = [
    { id: "light" as const, label: t("settings.appearanceLight"), icon: "sun" as const },
    { id: "dark" as const, label: t("settings.appearanceDark"), icon: "moon" as const },
  ];

  const lookUp = (each: string) => plugins.palette(each);
  // One of yours, to change (gone for a moment if it's deleted in another window), or lines' own.
  const mine = $derived(customThemes.get(id));
  const definition = $derived(mine ?? plugins.theme(id).definition);
  const schemes = $derived(SCHEMES.filter((scheme) => definition[scheme]));
  /** The scheme chosen to change; until one is, the one showing. */
  let chosen = $state<Scheme | null>(null);
  const editing = $derived(schemes.length === 1 ? schemes[0] : (chosen ?? (prefs.dark ? "dark" : "light")));
  const palette = $derived(lookUp(paletteOf(definition, editing)));
  /** Only a palette of yours takes new colors; a theme of yours drawn in one of lines' can have a copy. */
  const paletteMine = $derived(!!palette && !!customThemes.palette(palette.id));
  const names = $derived(palette ? paletteNames(palette) : new Map<string, string>());
  const parts = $derived(definition[editing] ?? {});
  /** Each part's palette color, as the palette has it. */
  const given = $derived(assigned(palette, parts));
  /** What each part is set to: its palette color, or what it's made from (`var(--accent)`), which the arrow takes out too. */
  const values = $derived({ ...definition.properties?.[editing], ...given });
  /** The theme's colors as lines works them out, on the preview and the swatches, which app.css works the rest out from. */
  const shown = $derived(resolveTheme(definition, lookUp)[editing]);
  const frame = $derived({
    "data-scheme": editing,
    style: Object.entries(shown)
      .map(([key, value]) => `--${key}: ${value}`)
      .join("; "),
  });
  const paletteOptions = $derived(paletteChoices());
  let more = $state(false);

  /** What a part is drawn in: its palette color's name, the part it's drawn as (`var(--accent)`), another made from the theme's colors, or Auto. */
  function nameOf(key: string) {
    if (given[key]) return names.get(parts[key])!;
    const property = definition.properties?.[editing]?.[key];
    if (property === undefined) return t("settings.colorAuto");
    const as = /^var\(--([a-z0-9-]+)\)$/.exec(property)?.[1];
    return as ? t("settings.colorSameAs", { name: colorName(as) }) : t("settings.colorMadeFrom");
  }

  /** A part's note, and that lines made its palette color lighter or darker for it to read, where it did. */
  function noteOf(key: string, note?: string) {
    const [from, drawn] = [parse(given[key]), parse(shown[key])];
    if (!from || !drawn || shown[key] === given[key]) return note;
    const shade = t(luminance(drawn) < luminance(from) ? "settings.colorDarker" : "settings.colorLighter", { name: names.get(parts[key])! });
    return note ? `${note} ${shade}` : shade;
  }

  /** A palette color chosen for a part, by its swatch; or a color of your own, which goes into the palette. */
  function choose(key: string, value: string | undefined) {
    const entry = value && palette?.colors.find((each) => each.color === value);
    if (entry) customThemes.assign(id, editing, key, entry.id);
    else customThemes.setColor(id, editing, key, value, palette);
  }

  function drawIn(scheme: Scheme, to: string) {
    customThemes.setPalette(id, [scheme], to, lookUp);
    speak(t("settings.paletteChosen", { name: lookUp(to)?.name ?? "" }));
  }

  function makeOther() {
    const [only] = schemes;
    if (!mine) return;
    const missing = only === "dark" ? "light" : "dark";
    customThemes.addScheme(id, missing, otherScheme(resolveTheme(mine, lookUp)[only]), palette);
    chosen = missing;
    speak(t(missing === "light" ? "settings.themeMadeLight" : "settings.themeMadeDark"));
  }

  /** The theme as a file to share, with its palettes, made when it's shared. */
  const file = () => ({ name: `${fileName(mine!.name)}${THEME_FILE_EXTENSION}`, text: writeThemeFile(customThemes.file(id)!) });

  /** Asking first, in the page: the Mac app's web view has no confirm(). */
  let confirming = $state(false);

  async function cancelDelete() {
    confirming = false;
    await tick();
    document.getElementById(`${uid}-delete`)?.focus();
  }
</script>

{#snippet actions()}
  <div class="flex items-center gap-1">
    {#if !mine}
      <Button icon="copy" onclick={oncopy}>{t("settings.makeCopy")}</Button>
    {:else if confirming}
      <Button variant="quiet" onclick={cancelDelete}>{t("settings.cancel")}</Button>
      <Button variant="danger-primary" onclick={ondelete}>{t("settings.themeDelete")}</Button>
    {:else}
      <ShareFileMenu label={t("settings.themeShare")} copyLabel={t("settings.themeCopy")} copied={t("settings.themeCopied")} downloadLabel={t("settings.themeDownload")} {file} />
      <IconButton
        id="{uid}-delete"
        icon="trash"
        label={t("settings.themeDelete")}
        onclick={() => {
          confirming = true;
          speak(t("settings.themeDeleteQuestion", { name: mine.name }));
        }}
      />
    {/if}
  </div>
{/snippet}

{#snippet paletteRow(scheme: Scheme)}
  {@const each = lookUp(paletteOf(definition, scheme))}
  {@const shared = schemes.length === 2 && paletteOf(definition, "light") === paletteOf(definition, "dark")}
  {@const label = schemes.length === 2 ? t(scheme === "light" ? "settings.paletteForLight" : "settings.paletteForDark") : t("settings.palette")}
  {@const builtIn = !!each && !customThemes.palette(each.id)}
  <FieldRow {label} note={mine && builtIn ? t("settings.paletteBuiltInNote", { name: each.name }) : shared ? t("settings.paletteShared") : null}>
    {#if mine}
      <div class="flex flex-wrap items-center justify-end gap-2">
        {#if builtIn}<Button variant="quiet" onclick={() => customThemes.ownPalette(id, scheme, each)}>{t("settings.makeCopy")}</Button>{/if}
        <Select value={paletteOf(definition, scheme)} options={paletteOptions} label={label} class="w-48" onchange={(to) => drawIn(scheme, to)} />
      </div>
    {:else if each}
      <span class="text-sm text-fg">{each.name}</span>
      <PaletteStrip palette={each} class="w-32" />
    {/if}
  </FieldRow>
{/snippet}

<!-- Where search leads to what isn't drawn for this theme: one of lines' own says to make a copy. -->
<FieldGroup
  title={definition.name}
  note={mine ? (mine.author ? t("settings.themeBy", { author: mine.author }) : null) : t("settings.themeBuiltInNote")}
  action={actions}
  data-settings-part="ThemeEditor"
>
  {#if mine}
    <FieldRow label={t("settings.themeName")} for="{uid}-name">
      <TextField
        id="{uid}-name"
        bind:input={nameField}
        value={mine.name}
        maxlength={80}
        class="w-56"
        oninput={(event) => customThemes.rename(id, event.currentTarget.value)}
        onblur={(event) => (event.currentTarget.value = mine.name)}
      />
    </FieldRow>
  {/if}
  {#if schemes.length === 2}
    <FieldRow label={t("settings.themeColorsFor")}>
      <Segmented label={t("settings.themeColorsFor")} options={schemeOptions} value={editing} onselect={(scheme) => (chosen = scheme)} />
    </FieldRow>
  {:else if mine}
    <FieldRow
      label={t(editing === "dark" ? "settings.themeOnlyDark" : "settings.themeOnlyLight")}
      note={t(editing === "dark" ? "settings.themeOnlyDarkNote" : "settings.themeOnlyLightNote")}
    >
      <Button icon="wand-sparkles" onclick={makeOther}>{t(editing === "dark" ? "settings.themeMakeLight" : "settings.themeMakeDark")}</Button>
    </FieldRow>
  {/if}
  {#each schemes as scheme (scheme)}{@render paletteRow(scheme)}{/each}
  <CardBlock>
    <ThemePreview {frame} />
  </CardBlock>
</FieldGroup>

{#each GROUPS.filter((group) => more || !group.more) as group (group.title)}
  <FieldGroup title={group.title} note={group.note}>
    {#each group.colors as { key, label, note } (key)}
      <FieldRow {label} note={noteOf(key, note)}>
        <!-- Formatting left on Auto with no color of app.css's (bold, a heading) is the text's around it. -->
        {#if mine}
          <ColorField
            id="{uid}-{key}"
            {label}
            value={values[key]}
            name={nameOf(key)}
            swatch="var(--{key}, var(--text))"
            {frame}
            optional={!needed.has(key)}
            swatches={swatchesOf(palette)}
            custom={paletteMine}
            onchange={(value) => choose(key, value)}
          />
        {:else}
          <span class="flex items-center gap-2">
            <span {...frame} class="contents" aria-hidden="true">
              <span class="size-7 rounded-md inset-ring inset-ring-line forced-color-adjust-none" style:background="var(--{key}, var(--text))"></span>
            </span>
            <span class="w-36 truncate text-sm text-fg">{nameOf(key)}</span>
          </span>
        {/if}
      </FieldRow>
    {/each}
  </FieldGroup>
{/each}

<div class="-mt-2 flex">
  <Button variant="quiet" icon={more ? "chevron-up" : "chevron-down"} aria-expanded={more} onclick={() => (more = !more)}>
    {more ? t("settings.themeFewerColors") : t("settings.themeMoreColors")}
  </Button>
</div>
