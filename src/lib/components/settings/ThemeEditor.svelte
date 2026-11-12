<script lang="ts">
  // Changing a theme of your own: its name, each of its colors for light and dark with a preview,
  // making the scheme it lacks, sharing it as a file, and deleting it.
  import { onMount, tick } from "svelte";
  import { speak } from "../../a11y";
  import { PALETTE } from "../../palette";
  import { t } from "../../i18n/index.svelte";
  import { fileName } from "../../notes/fileName";
  import { reducedMotion } from "../../platform";
  import { prefs } from "../../prefs.svelte";
  import type { ThemeColors } from "../../plugins/types";
  import { customThemes } from "../../themes/custom.svelte";
  import { SCHEMES, THEME_FILE_EXTENSION, writeThemeFile } from "../../themes/file";
  import { BASE_COLORS, otherScheme, type Scheme } from "../../themes/palette";
  import Button from "../ui/Button.svelte";
  import CardBlock from "./CardBlock.svelte";
  import { colorName } from "./colorNames";
  import ColorField from "../ui/ColorField.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import TextField from "../ui/TextField.svelte";
  import ShareFileMenu from "./ShareFileMenu.svelte";
  import ThemePreview from "./ThemePreview.svelte";

  /** `fresh`: just made, so its name is selected, to type over. */
  let { id, fresh = false, ondelete }: { id: string; fresh?: boolean; ondelete: () => void } = $props();
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
  const GROUPS: { title: string; colors: Color[]; more?: boolean }[] = [
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
  const needed = new Set<string>(BASE_COLORS);
  const schemeOptions = [
    { id: "light" as const, label: t("settings.appearanceLight"), icon: "sun" as const },
    { id: "dark" as const, label: t("settings.appearanceDark"), icon: "moon" as const },
  ];

  // Gone for a moment if it's deleted in another window, until Appearance stops showing this.
  const theme = $derived(customThemes.get(id));
  const schemes = $derived(SCHEMES.filter((scheme) => theme?.[scheme]));
  /** The scheme chosen to change; until one is, the one showing. */
  let chosen = $state<Scheme | null>(null);
  const editing = $derived(schemes.length === 1 ? schemes[0] : (chosen ?? (prefs.dark ? "dark" : "light")));
  const colors: Partial<ThemeColors> = $derived(theme?.[editing] ?? {});
  /** The colors on the preview and the swatches, which work out the rest from them as app.css does. */
  const frame = $derived({
    "data-scheme": editing,
    style: Object.entries(colors)
      .map(([key, value]) => `--${key}: ${value}`)
      .join("; "),
  });
  let more = $state(false);

  function makeOther() {
    const [only] = schemes;
    if (!theme) return;
    const missing = only === "dark" ? "light" : "dark";
    customThemes.addScheme(id, missing, otherScheme(theme[only]!));
    chosen = missing;
    speak(t(missing === "light" ? "settings.themeMadeLight" : "settings.themeMadeDark"));
  }

  /** The theme as a file to share, made when it's shared. */
  const file = () => ({ name: `${fileName(theme!.name)}${THEME_FILE_EXTENSION}`, text: writeThemeFile($state.snapshot(theme!)) });

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
    {#if confirming}
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
          speak(t("settings.themeDeleteQuestion", { name: theme!.name }));
        }}
      />
    {/if}
  </div>
{/snippet}

{#if theme}
  <FieldGroup title={theme.name} note={theme.author ? t("settings.themeBy", { author: theme.author }) : null} action={actions}>
    <FieldRow label={t("settings.themeName")} for="{uid}-name">
      <TextField
        id="{uid}-name"
        bind:input={nameField}
        value={theme.name}
        maxlength={80}
        class="w-56"
        oninput={(event) => customThemes.rename(id, event.currentTarget.value)}
        onblur={(event) => (event.currentTarget.value = theme.name)}
      />
    </FieldRow>
    {#if schemes.length === 2}
      <FieldRow label={t("settings.themeColorsFor")}>
        <Segmented label={t("settings.themeColorsFor")} options={schemeOptions} value={editing} onselect={(scheme) => (chosen = scheme)} />
      </FieldRow>
    {:else}
      <FieldRow
        label={t(editing === "dark" ? "settings.themeOnlyDark" : "settings.themeOnlyLight")}
        note={t(editing === "dark" ? "settings.themeOnlyDarkNote" : "settings.themeOnlyLightNote")}
      >
        <Button icon="wand-sparkles" onclick={makeOther}>{t(editing === "dark" ? "settings.themeMakeLight" : "settings.themeMakeDark")}</Button>
      </FieldRow>
    {/if}
    <CardBlock>
      <ThemePreview {frame} />
    </CardBlock>
  </FieldGroup>

  {#each GROUPS.filter((group) => more || !group.more) as group (group.title)}
    <FieldGroup title={group.title}>
      {#each group.colors as { key, label, note } (key)}
        <FieldRow {label} {note} for="{uid}-{key}">
          <ColorField
            id="{uid}-{key}"
            {label}
            value={colors[key]}
            swatch="var(--{key})"
            {frame}
            optional={!needed.has(key)}
            onchange={(value) => customThemes.setColor(id, editing, key, value)}
          />
        </FieldRow>
      {/each}
    </FieldGroup>
  {/each}

  <div class="-mt-2 flex">
    <Button variant="quiet" icon={more ? "chevron-up" : "chevron-down"} aria-expanded={more} onclick={() => (more = !more)}>
      {more ? t("settings.themeFewerColors") : t("settings.themeMoreColors")}
    </Button>
  </div>
{/if}
