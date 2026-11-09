<script lang="ts">
  import { locale, type MessageKey, t } from "../../i18n/index.svelte";
  import { LINK_ACTIONS, LINK_CLICKS, MARKDOWN_MODES, prefs, SHEET_STATS, type LinkAction, type LinkClick, type LinkKind, type MarkdownMode, type SheetStat } from "../../prefs.svelte";
  import { CURRENCIES, DATE_STYLES, MONEY_STYLES, NEGATIVE_STYLES, showDate, showMoney } from "../../sheets/display";
  import { formatKeys, speakKeys, system } from "../../shortcuts";
  import { canFloat } from "../../windows/floating";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Select from "../ui/Select.svelte";
  import Switch from "../ui/Switch.svelte";
  import TypingSounds from "./TypingSounds.svelte";

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

  // Spreadsheets: each choice shown as it looks, today's date and an amount in the chosen currency.
  const today = new Date().toISOString().slice(0, 10);
  const dateOptions = DATE_STYLES.map((style) => ({ value: style, label: showDate(today, style, locale) }));
  const currencyNames = new Intl.DisplayNames([locale], { type: "currency" });
  const currencyOptions = CURRENCIES.map((code) => ({ value: code, label: `${currencyNames.of(code) ?? code} (${code})` }));
  const moneyOptions = $derived(MONEY_STYLES.map((style) => ({ value: style, label: showMoney(1234.56, prefs.sheetCurrency, { money: style, negative: "minus", locale }) })));
  const negativeOptions = $derived(
    NEGATIVE_STYLES.map((style) => {
      const amount = showMoney(-1234.56, prefs.sheetCurrency, { money: prefs.sheetMoney, negative: style, locale });
      return { value: style, label: style === "red" || style === "redParens" ? t("settings.sheetNegativeRed", { amount }) : amount };
    }),
  );
  const STAT_NAMES: Record<SheetStat, MessageKey> = {
    sum: "sheet.sum",
    average: "sheet.average",
    min: "sheet.min",
    max: "sheet.max",
    count: "sheet.count",
  };
  const showStat = (stat: SheetStat, on: boolean) => {
    prefs.sheetStats = SHEET_STATS.filter((s) => (s === stat ? on : prefs.sheetStats.includes(s)));
  };
</script>

<FieldGroup title={t("settings.writing")}>
  <FieldRow label={t("settings.markdownMode")} note={`${t(MODE_NAMES[prefs.markdownMode][1])} ${t("settings.showMarkdownNote")}`}>
    <Segmented label={t("settings.markdownMode")} options={modes} value={prefs.markdownMode} onselect={(mode) => (prefs.markdownMode = mode)} />
  </FieldRow>
  <FieldRow label={t("settings.dragBlocks")} note={t("settings.dragBlocksNote")}>
    <Switch label={t("settings.dragBlocks")} checked={prefs.dragBlocks} onchange={(on) => (prefs.dragBlocks = on)} />
  </FieldRow>
  <FieldRow label={t("settings.spellcheck")} note={t("settings.spellcheckNote")}>
    <Switch label={t("settings.spellcheck")} checked={prefs.spellcheck} onchange={(on) => (prefs.spellcheck = on)} />
  </FieldRow>
</FieldGroup>

<TypingSounds />

<FieldGroup title={t("settings.symbols")} note={t("settings.symbolsNote")}>
  <FieldRow label={t("settings.symbolsInText")}>
    <Switch label={t("settings.symbolsInText")} checked={prefs.symbolsInText} onchange={(on) => (prefs.symbolsInText = on)} />
  </FieldRow>
  <FieldRow label={t("settings.symbolsInCode")}>
    <Switch label={t("settings.symbolsInCode")} checked={prefs.symbolsInCode} onchange={(on) => (prefs.symbolsInCode = on)} />
  </FieldRow>
</FieldGroup>

<FieldGroup title={t("settings.spreadsheets")} note={t("settings.spreadsheetsNote")}>
  <FieldRow label={t("settings.sheetHeadings")}>
    <Switch label={t("settings.sheetHeadings")} checked={prefs.sheetHeadings} onchange={(on) => (prefs.sheetHeadings = on)} />
  </FieldRow>
  <FieldRow label={t("settings.sheetHeaderRow")}>
    <Switch label={t("settings.sheetHeaderRow")} checked={prefs.sheetHeaderRow} onchange={(on) => (prefs.sheetHeaderRow = on)} />
  </FieldRow>
  <FieldRow label={t("settings.sheetHeaderColumn")}>
    <Switch label={t("settings.sheetHeaderColumn")} checked={prefs.sheetHeaderColumn} onchange={(on) => (prefs.sheetHeaderColumn = on)} />
  </FieldRow>
  <FieldRow label={t("settings.sheetDates")}>
    <Select label={t("settings.sheetDates")} value={prefs.sheetDates} options={dateOptions} onchange={(style) => (prefs.sheetDates = style)} />
  </FieldRow>
  <FieldRow label={t("settings.sheetCurrency")} note={t("settings.sheetCurrencyNote")}>
    <Select label={t("settings.sheetCurrency")} value={prefs.sheetCurrency} options={currencyOptions} onchange={(code) => (prefs.sheetCurrency = code)} />
  </FieldRow>
  <FieldRow label={t("settings.sheetMoney")}>
    <Select label={t("settings.sheetMoney")} value={prefs.sheetMoney} options={moneyOptions} onchange={(style) => (prefs.sheetMoney = style)} />
  </FieldRow>
  <FieldRow label={t("settings.sheetMoneyEdge")} note={t("settings.sheetMoneyEdgeNote")}>
    <Switch label={t("settings.sheetMoneyEdge")} checked={prefs.sheetMoneyEdge} onchange={(on) => (prefs.sheetMoneyEdge = on)} />
  </FieldRow>
  <FieldRow label={t("settings.sheetNegative")} note={t("settings.sheetNegativeNote")}>
    <Select label={t("settings.sheetNegative")} value={prefs.sheetNegative} options={negativeOptions} onchange={(style) => (prefs.sheetNegative = style)} />
  </FieldRow>
</FieldGroup>

<FieldGroup title={t("settings.sheetStats")} note={t("settings.sheetStatsNote")}>
  {#each SHEET_STATS as stat (stat)}
    <FieldRow label={t(STAT_NAMES[stat])}>
      <Switch label={t(STAT_NAMES[stat])} checked={prefs.sheetStats.includes(stat)} onchange={(on) => showStat(stat, on)} />
    </FieldRow>
  {/each}
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
