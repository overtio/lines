<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { t } from "../i18n/index.svelte";
  import { openExternal } from "../platform";

  const REPO = "https://github.com/overtio/lines";
  const version = __APP_VERSION__;

  /** The open source projects lines is built on; every license is in the full notices below. */
  const CREDITS = [
    { name: "Svelte", license: "MIT", url: "https://svelte.dev" },
    { name: "CodeMirror & Lezer", license: "MIT", url: "https://codemirror.net" },
    { name: "Tauri", license: "MIT / Apache-2.0", url: "https://tauri.app" },
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

<section class="hero">
  <img src="{import.meta.env.BASE_URL}icon.svg" alt="" width="64" height="64" />
  <div>
    <h2>lines</h2>
    <p class="version">{t("settings.version", { version })}</p>
    <p class="tagline">{t("settings.tagline")}</p>
  </div>
</section>

<section>
  <p class="prose">{t("settings.madeBy")}</p>
  <div class="links">
    <button class="text-button" onclick={() => openExternal(REPO)}>
      <Icon name="code" size={15} />
      {t("settings.source")}
    </button>
    <button class="text-button" onclick={() => openExternal(`${REPO}/issues`)}>
      <Icon name="message-circle" size={15} />
      {t("settings.reportIssue")}
    </button>
  </div>
</section>

<section>
  <h3>{t("settings.license")}</h3>
  <p class="prose">
    {licenseBefore}<button class="link" onclick={() => openExternal(`${REPO}/blob/main/LICENSE`)}
      >GNU Affero General Public License v3.0</button
    >{licenseAfter}
  </p>
</section>

<section>
  <h3>{t("settings.openSource")}</h3>
  <p class="prose">{t("settings.openSourceText")}</p>
  <ul class="credits">
    {#each CREDITS as credit (credit.name)}
      <li>
        <button class="link" onclick={() => openExternal(credit.url)}>{credit.name}</button>
        <span>{credit.license}</span>
      </li>
    {/each}
  </ul>
  <p class="prose">{t("settings.sfSymbolsCredit")}</p>
  <button class="text-button flush notices-toggle" onclick={toggleNotices} aria-expanded={noticesOpen}>
    <Icon name="chevron-right" size={14} />
    {noticesOpen ? t("settings.hideNotices") : t("settings.showNotices")}
  </button>
  {#if noticesOpen}
    <!-- Focusable, so the long text can be scrolled with the keyboard. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <pre class="notices" tabindex="0" role="region" aria-label={t("settings.notices")} aria-busy={notices === null}>{notices ??
        t("settings.loading")}</pre>
  {/if}
</section>

<style>
  .hero {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .hero img {
    flex-shrink: 0;
    border-radius: 14px;
  }

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
  }

  .version {
    margin: 2px 0 0;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    color: var(--text-faint);
  }

  .tagline {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: -4px 0 0 -10px;
  }

  .link {
    color: var(--accent);
    font: inherit;
    text-decoration: underline;
    text-decoration-color: var(--accent-soft);
    text-underline-offset: 2px;
  }

  .credits {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 6px 16px;
    margin: 0 0 12px;
    font-size: 13px;
  }

  .credits li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  /* Big enough to hit (24px), though they sit close together. */
  .credits .link {
    min-height: 24px;
    text-align: left;
  }

  .credits span {
    color: var(--text-faint);
    font-size: 12px;
  }

  .notices-toggle :global(.icon) {
    transition: transform 150ms ease;
  }

  .notices-toggle[aria-expanded="true"] :global(.icon) {
    transform: rotate(90deg);
  }

  .notices {
    max-height: 320px;
    margin: 8px 0 0;
    padding: 12px;
    overflow: auto;
    border-radius: 8px;
    background: var(--code-bg);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.5;
    white-space: pre-wrap;
    color: var(--text-muted);
    user-select: text;
    -webkit-user-select: text;
  }
</style>
