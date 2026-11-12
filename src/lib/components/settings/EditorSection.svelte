<script lang="ts">
  import { type MessageKey, t } from "../../i18n/index.svelte";
  import { LINK_ACTIONS, LINK_CLICKS, MARKDOWN_MODES, prefs, type LinkAction, type LinkClick, type LinkKind, type MarkdownMode } from "../../prefs.svelte";
  import { formatKeys, speakKeys, system } from "../../shortcuts";
  import { canFloat } from "../../windows/floating";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Select from "../ui/Select.svelte";
  import Switch from "../ui/Switch.svelte";

  const MODE_NAMES: Record<MarkdownMode, [name: MessageKey, note: MessageKey]> = {
    source: ["settings.markdownSource", "settings.markdownSourceNote"],
    visible: ["settings.markdownVisible", "settings.markdownVisibleNote"],
    live: ["settings.markdownLive", "settings.markdownLiveNote"],
    hidden: ["settings.markdownHidden", "settings.markdownHiddenNote"],
  };
  const modes = $derived(MARKDOWN_MODES.map((id) => ({ id, label: t(MODE_NAMES[id][0]) })));

  const LINK_KINDS: { kind: LinkKind; name: MessageKey }[] = [
    { kind: "web", name: "settings.linksWeb" },
    { kind: "tag", name: "settings.linksTag" },
    { kind: "mention", name: "settings.linksMention" },
  ];
  const CLICK_KEYS: Record<LinkClick, string> = { click: "click", modClick: "Mod-click", modShiftClick: "Mod-Shift-click" };
  /** What a choice reads as, which for opening depends on what's opened. */
  const ACTION_NAMES: Record<LinkAction, MessageKey> = {
    edit: "settings.linkEdit",
    open: "settings.linkOpen",
    copy: "settings.linkCopy",
    newTab: "settings.linkNewTab",
    backgroundTab: "settings.linkBackgroundTab",
    window: "settings.linkWindow",
  };
  const actionName = (kind: LinkKind, action: LinkAction) => t(kind === "tag" && action === "open" ? "settings.linkShowNotes" : ACTION_NAMES[action]);
  // Floating windows are the desktop apps' alone.
  const actionsOf = (kind: LinkKind) =>
    LINK_ACTIONS[kind].filter((action) => action !== "window" || canFloat).map((action) => ({ value: action, label: actionName(kind, action) }));
  const clickName = (click: LinkClick) => (click === "click" ? t("settings.linkClick") : formatKeys(CLICK_KEYS[click], system));
  const spokenClick = (click: LinkClick) => (click === "click" ? t("settings.linkClick") : speakKeys(CLICK_KEYS[click], system));
</script>

<FieldGroup title={t("settings.writing")}>
  <FieldRow label={t("settings.markdownMode")} note={`${t(MODE_NAMES[prefs.markdownMode][1])} ${t("settings.showMarkdownNote")}`}>
    <Segmented label={t("settings.markdownMode")} options={modes} value={prefs.markdownMode} onselect={(mode) => (prefs.markdownMode = mode)} />
  </FieldRow>
  <FieldRow label={t("settings.dragBlocks")} note={t("settings.dragBlocksNote")}>
    <Switch label={t("settings.dragBlocks")} checked={prefs.dragBlocks} onchange={(on) => (prefs.dragBlocks = on)} />
  </FieldRow>
  <FieldRow label={t("settings.underlinedHeadings")} note={t("settings.underlinedHeadingsNote")}>
    <Switch label={t("settings.underlinedHeadings")} checked={prefs.underlinedHeadings} onchange={(on) => (prefs.underlinedHeadings = on)} />
  </FieldRow>
  <FieldRow label={t("settings.spellcheck")} note={t("settings.spellcheckNote")}>
    <Switch label={t("settings.spellcheck")} checked={prefs.spellcheck} onchange={(on) => (prefs.spellcheck = on)} />
  </FieldRow>
  <FieldRow label={t("settings.copyOnSelect")} note={t("settings.copyOnSelectNote")}>
    <Switch label={t("settings.copyOnSelect")} checked={prefs.copyOnSelect} onchange={(on) => (prefs.copyOnSelect = on)} />
  </FieldRow>
</FieldGroup>

<FieldGroup title={t("settings.symbols")} note={t("settings.symbolsNote")}>
  <FieldRow label={t("settings.symbolsInText")}>
    <Switch label={t("settings.symbolsInText")} checked={prefs.symbolsInText} onchange={(on) => (prefs.symbolsInText = on)} />
  </FieldRow>
  <FieldRow label={t("settings.symbolsInCode")}>
    <Switch label={t("settings.symbolsInCode")} checked={prefs.symbolsInCode} onchange={(on) => (prefs.symbolsInCode = on)} />
  </FieldRow>
</FieldGroup>

<FieldGroup title={t("settings.links")} note={t("settings.linksNote", { openKey: formatKeys("Alt-Enter", system) })}>
  <!-- A table rather than rows: each kind of link has a choice for each way of clicking it. -->
  <div class="overflow-x-auto px-2.5 py-1.5">
    <table class="w-full min-w-[440px] table-fixed border-separate border-spacing-x-1.5 border-spacing-y-2 text-sm">
      <thead>
        <tr>
          <td class="w-[22%]"></td>
          {#each LINK_CLICKS as click (click)}
            <th scope="col" class="text-start text-xs font-medium text-muted" aria-label={spokenClick(click)}>{clickName(click)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each LINK_KINDS as { kind, name } (kind)}
          <tr>
            <th scope="row" class="text-start font-medium text-fg">{t(name)}</th>
            {#each LINK_CLICKS as click (click)}
              <td>
                <Select
                  class="w-full min-w-0!"
                  label="{t(name)}, {spokenClick(click)}"
                  value={prefs.links[kind][click]}
                  options={actionsOf(kind)}
                  onchange={(action) => (prefs.links[kind][click] = action)}
                />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</FieldGroup>
