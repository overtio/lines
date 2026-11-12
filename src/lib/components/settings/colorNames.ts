import { t } from "../../i18n/index.svelte";
import { PALETTE } from "../../palette";

/*
 * What a theme's colors are called, by their custom property (app.css): in Settings → Theme's
 * editor, and when one is changed by right-clicking it (ColorPicking.svelte).
 */

const NAMES: Record<string, () => string> = {
  bg: () => t("settings.color.bg"),
  "bg-list": () => t("settings.color.bgList"),
  "bg-sidebar": () => t("settings.color.bgSidebar"),
  "bg-elevated": () => t("settings.color.bgElevated"),
  text: () => t("settings.color.text"),
  "text-sidebar": () => t("settings.color.textSidebar"),
  "text-muted": () => t("settings.color.textMuted"),
  "text-faint": () => t("settings.color.textFaint"),
  accent: () => t("settings.color.accent"),
  "tag-text": () => t("sidebar.tags"),
  ink: () => t("settings.color.ink"),
  danger: () => t("settings.color.danger"),
  success: () => t("settings.color.success"),
  pin: () => t("settings.color.pin"),
  "highlight-base": () => t("settings.color.highlight"),
  "syn-keyword": () => t("settings.color.synKeyword"),
  "syn-string": () => t("settings.color.synString"),
  "syn-number": () => t("settings.color.synNumber"),
  "syn-comment": () => t("settings.color.synComment"),
  "syn-function": () => t("settings.color.synFunction"),
  "syn-type": () => t("settings.color.synType"),
  border: () => t("settings.color.border"),
  "card-border": () => t("settings.color.cardBorder"),
  "card-bg": () => t("settings.color.cardBg"),
  hover: () => t("settings.color.hover"),
  active: () => t("settings.color.active"),
  selection: () => t("settings.color.selection"),
  "tag-bg": () => t("settings.color.tagBg"),
  "code-bg": () => t("settings.color.codeBg"),
  input: () => t("settings.color.input"),
  "on-accent": () => t("settings.color.onAccent"),
  "callout-info": () => t("editor.callout.info"),
  "callout-question": () => t("editor.callout.question"),
  "callout-warning": () => t("editor.callout.warning"),
  "callout-error": () => t("editor.callout.error"),
  "callout-decision": () => t("editor.callout.decision"),
  ...Object.fromEntries(PALETTE.map((color) => [`palette-${color}`, () => t(`picker.color.${color}`)])),
};

/** A theme color's name, as Settings shows it. */
export const colorName = (key: string) => NAMES[key]?.() ?? key;
