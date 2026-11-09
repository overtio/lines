<script lang="ts">
  // Changing a theme of your own: its name, each of its colors for light and dark with a preview,
  // making the scheme it lacks, sharing it as a file, and deleting it.
  import { DropdownMenu } from "bits-ui";
  import { onMount, tick } from "svelte";
  import { speak } from "../../a11y";
  import { t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { fileName } from "../../notes/export";
  import { copyText, reducedMotion } from "../../platform";
  import { prefs } from "../../prefs.svelte";
  import { saveAndShow } from "../../save";
  import type { ThemeColors } from "../../plugins/types";
  import { customThemes } from "../../themes/custom.svelte";
  import { SCHEMES, THEME_FILE_EXTENSION, writeThemeFile } from "../../themes/file";
  import { BASE_COLORS, otherScheme, type Scheme } from "../../themes/palette";
  import Button from "../ui/Button.svelte";
  import CardBlock from "./CardBlock.svelte";
  import ColorField from "../ui/ColorField.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import { floating, option } from "../ui/styles";
  import TextField from "../ui/TextField.svelte";
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
  const GROUPS: { title: string; colors: Color[]; more?: boolean }[] = [
    {
      title: t("settings.themeBackgrounds"),
      colors: [
        { key: "bg", label: t("settings.color.bg") },
        { key: "bg-list", label: t("settings.color.bgList") },
        { key: "bg-sidebar", label: t("settings.color.bgSidebar") },
        { key: "bg-elevated", label: t("settings.color.bgElevated") },
      ],
    },
    {
      title: t("settings.themeText"),
      colors: [
        { key: "text", label: t("settings.color.text") },
        { key: "text-sidebar", label: t("settings.color.textSidebar") },
        { key: "text-muted", label: t("settings.color.textMuted"), note: t("settings.color.textMutedNote") },
        { key: "text-faint", label: t("settings.color.textFaint"), note: t("settings.color.textFaintNote") },
      ],
    },
    {
      title: t("settings.themeAccent"),
      colors: [
        { key: "accent", label: t("settings.color.accent"), note: t("settings.color.accentNote") },
        { key: "tag-text", label: t("sidebar.tags") },
        { key: "ink", label: t("settings.color.ink"), note: t("settings.color.inkNote") },
      ],
    },
    {
      title: t("settings.themeStatus"),
      more: true,
      colors: [
        { key: "danger", label: t("settings.color.danger"), note: t("settings.color.dangerNote") },
        { key: "success", label: t("settings.color.success") },
        { key: "pin", label: t("settings.color.pin") },
        { key: "highlight-base", label: t("settings.color.highlight") },
      ],
    },
    {
      title: t("settings.themeCallouts"),
      more: true,
      colors: [
        { key: "callout-info", label: t("editor.callout.info") },
        { key: "callout-question", label: t("editor.callout.question") },
        { key: "callout-warning", label: t("editor.callout.warning") },
        { key: "callout-error", label: t("editor.callout.error") },
        { key: "callout-decision", label: t("editor.callout.decision") },
      ],
    },
    {
      title: t("settings.themeCode"),
      more: true,
      colors: [
        { key: "syn-keyword", label: t("settings.color.synKeyword") },
        { key: "syn-string", label: t("settings.color.synString") },
        { key: "syn-number", label: t("settings.color.synNumber") },
        { key: "syn-comment", label: t("settings.color.synComment") },
        { key: "syn-function", label: t("settings.color.synFunction") },
        { key: "syn-type", label: t("settings.color.synType") },
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
  // Where the share sheet takes files (Safari, the Mac and phone apps), it's offered too.
  const canShareFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [new File(["{}"], "theme.json", { type: "application/json" })] });

  function share() {
    const { name, text } = file();
    void navigator.share({ files: [new File([text], name, { type: "application/json" })] }).catch(() => {});
  }

  async function copy() {
    await copyText(file().text);
    speak(t("settings.themeCopied"));
  }

  function download() {
    const { name, text } = file();
    void saveAndShow(name, async () => new TextEncoder().encode(text), "application/json");
  }

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
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <IconButton {...props} icon="share" label={t("settings.themeShare")} />
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} aria-label={t("settings.themeShare")} class="{floating} min-w-[200px] p-[5px]">
            {#if canShareFiles}
              <DropdownMenu.Item class={option} onSelect={share}>
                <Icon name="share" size={15} />{t("app.shareSheet")}
              </DropdownMenu.Item>
            {/if}
            <DropdownMenu.Item class={option} onSelect={() => void copy()}>
              <Icon name="copy" size={15} />{t("settings.themeCopy")}
            </DropdownMenu.Item>
            <DropdownMenu.Item class={option} onSelect={download}>
              <Icon name="download" size={15} />{t("settings.themeDownload")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
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
