<script lang="ts">
  // Settings → Plugins → Spreadsheets: how spreadsheets look (their headings, a header row and
  // column), how dates and money show in them, and the figures shown for the cells selected.
  import { locale, type MessageKey, t } from "../../lib/i18n/index.svelte";
  import { prefs, SHEET_STATS, type SheetStat } from "../../lib/prefs.svelte";
  import { CURRENCIES, DATE_STYLES, MONEY_STYLES, NEGATIVE_STYLES, showDate, showMoney } from "../../lib/sheets/display";
  import FieldGroup from "../../lib/components/ui/FieldGroup.svelte";
  import FieldRow from "../../lib/components/ui/FieldRow.svelte";
  import Select from "../../lib/components/ui/Select.svelte";
  import Switch from "../../lib/components/ui/Switch.svelte";

  // Each choice shown as it looks: today's date, and an amount in the chosen currency.
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
