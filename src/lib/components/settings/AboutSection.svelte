<script lang="ts">
  import Icon from "../../icons/Icon.svelte";
  import { t } from "../../i18n/index.svelte";
  import { openExternal } from "../../platform";
  import { REPO, VERSION as version } from "../../release";
  import { updates } from "../../updates.svelte";
  import Button from "../ui/Button.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import UpdatesGroup from "./UpdatesGroup.svelte";

  /** The open source projects lines is built on; every license is in the full notices below. */
  const CREDITS = [
    { name: "Svelte", license: "MIT", url: "https://svelte.dev" },
    { name: "CodeMirror & Lezer", license: "MIT", url: "https://codemirror.net" },
    { name: "Tauri", license: "MIT / Apache-2.0", url: "https://tauri.app" },
    { name: "Bits UI", license: "MIT", url: "https://bits-ui.com" },
    { name: "Tailwind CSS", license: "MIT", url: "https://tailwindcss.com" },
    { name: t("settings.creditIcons", { name: "Lucide" }), license: "ISC", url: "https://lucide.dev" },
    { name: "aws4fetch", license: "MIT", url: "https://github.com/mhart/aws4fetch" },
    { name: "objc2", license: "MIT", url: "https://github.com/madsmtm/objc2" },
    { name: t("settings.creditColors", { name: "Solarized" }), license: "MIT", url: "https://ethanschoonover.com/solarized/" },
    { name: t("settings.creditColors", { name: "Nord" }), license: "MIT", url: "https://www.nordtheme.com" },
    { name: t("settings.creditColors", { name: "Dracula" }), license: "MIT", url: "https://draculatheme.com" },
    { name: t("settings.creditColors", { name: "Catppuccin" }), license: "MIT", url: "https://catppuccin.com" },
    { name: t("settings.creditColors", { name: "Tokyo Night" }), license: "MIT", url: "https://github.com/tokyo-night/tokyo-night-vscode-theme" },
    { name: t("settings.creditColors", { name: "Gruvbox" }), license: "MIT", url: "https://gruvbox.org" },
    { name: t("settings.creditColors", { name: "Everforest" }), license: "MIT", url: "https://github.com/sainnhe/everforest" },
    { name: t("settings.creditColors", { name: "Ayu" }), license: "MIT", url: "https://github.com/ayu-theme" },
  ];

  /** The license paragraph, around its link: the license's name is a placeholder in the message. */
  const [licenseBefore, licenseAfter = ""] = t("settings.licenseText").split("{license}");

  let notices = $state<string | null>(null);
  let noticesOpen = $state(false);

  async function toggleNotices() {
    noticesOpen = !noticesOpen;
    if (noticesOpen && notices === null) {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}third-party-notices.txt`);
        notices = response.ok ? await response.text() : t("settings.noticesFailed");
      } catch {
        notices = t("settings.noticesFailed");
      }
    }
  }
</script>

{#snippet link(label: string, url: string, className = "")}
  <button
    class="cursor-pointer text-left text-accent underline decoration-accent-soft underline-offset-2 {className}"
    onclick={() => openExternal(url)}>{label}</button
  >
{/snippet}

<section class="flex flex-wrap items-center gap-4 px-1">
  <img src="{import.meta.env.BASE_URL}icon.svg" alt="" width="64" height="64" class="shrink-0 rounded-xl" />
  <div class="min-w-0 flex-1">
    <h3 class="m-0 text-xl font-bold">lines</h3>
    <p class="tabular m-0 mt-0.5 text-xs text-faint">{t("settings.version", { version })}</p>
    <p class="m-0 mt-1 text-sm text-muted">{t("settings.tagline")}</p>
  </div>
</section>

{#if updates.supported}<UpdatesGroup />{/if}

<FieldGroup>
  <div class="px-4 py-3">
    <p class="m-0 text-sm leading-normal text-muted">{t("settings.madeBy")}</p>
    <div class="mt-1.5 -ml-2.5 flex flex-wrap gap-1">
      <Button variant="quiet" icon="code" onclick={() => openExternal(REPO)}>{t("settings.source")}</Button>
      <Button variant="quiet" icon="message-circle" onclick={() => openExternal(`${REPO}/issues`)}>{t("settings.reportIssue")}</Button>
    </div>
  </div>
</FieldGroup>

<FieldGroup title={t("settings.license")}>
  <p class="m-0 px-4 py-3 text-sm leading-normal text-muted">
    {licenseBefore}{@render link("GNU Affero General Public License v3.0", `${REPO}/blob/main/LICENSE`)}{licenseAfter}
  </p>
</FieldGroup>

<FieldGroup title={t("settings.openSource")} note={t("settings.openSourceText")}>
  <ul class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-4 gap-y-1.5 border-b border-line px-4 py-3 text-sm">
    {#each CREDITS as credit (credit.name)}
      <li class="flex items-center justify-between gap-2">
        <!-- Big enough to hit (24px), though they sit close together. -->
        {@render link(credit.name, credit.url, "min-h-6")}
        <span class="text-xs text-faint">{credit.license}</span>
      </li>
    {/each}
  </ul>
  <div class="px-4 py-3">
    <p class="m-0 text-sm leading-normal text-muted">{t("settings.sfSymbolsCredit")}</p>
    <Button variant="quiet" class="mt-1.5 -ml-2.5" onclick={toggleNotices} aria-expanded={noticesOpen}>
      <Icon name="chevron-right" size={14} class="transition-transform duration-150 {noticesOpen ? 'rotate-90' : ''}" />
      {noticesOpen ? t("settings.hideNotices") : t("settings.showNotices")}
    </Button>
    {#if noticesOpen}
      <!-- Focusable, so the long text can be scrolled with the keyboard. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <pre
        class="m-0 mt-2 max-h-80 overflow-auto rounded-md bg-code p-3 font-mono text-2xs leading-normal whitespace-pre-wrap text-muted select-text"
        tabindex="0"
        role="region"
        aria-label={t("settings.notices")}
        aria-busy={notices === null}>{notices ?? t("settings.loading")}</pre>
    {/if}
  </div>
</FieldGroup>
