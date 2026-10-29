<script lang="ts">
  import Icon from "../icons/Icon.svelte";
  import { openExternal } from "../platform";

  const REPO = "https://github.com/overtio/lines";
  const version = __APP_VERSION__;

  /** The open source projects lines is built on; every license is in the full notices below. */
  const CREDITS = [
    { name: "Svelte", license: "MIT", url: "https://svelte.dev" },
    { name: "CodeMirror & Lezer", license: "MIT", url: "https://codemirror.net" },
    { name: "Tauri", license: "MIT / Apache-2.0", url: "https://tauri.app" },
    { name: "Lucide icons", license: "ISC", url: "https://lucide.dev" },
    { name: "aws4fetch", license: "MIT", url: "https://github.com/mhart/aws4fetch" },
    { name: "objc2", license: "MIT", url: "https://github.com/madsmtm/objc2" },
    { name: "Solarized colors", license: "MIT", url: "https://ethanschoonover.com/solarized/" },
    { name: "Nord colors", license: "MIT", url: "https://www.nordtheme.com" },
    { name: "Dracula colors", license: "MIT", url: "https://draculatheme.com" },
    { name: "Catppuccin colors", license: "MIT", url: "https://catppuccin.com" },
    { name: "Tokyo Night colors", license: "MIT", url: "https://github.com/tokyo-night/tokyo-night-vscode-theme" },
    { name: "Gruvbox colors", license: "MIT", url: "https://gruvbox.org" },
    { name: "Everforest colors", license: "MIT", url: "https://github.com/sainnhe/everforest" },
    { name: "Ayu colors", license: "MIT", url: "https://github.com/ayu-theme" },
  ];

  let notices = $state<string | null>(null);
  let noticesOpen = $state(false);

  async function toggleNotices() {
    noticesOpen = !noticesOpen;
    if (noticesOpen && notices === null) {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}third-party-notices.txt`);
        notices = response.ok ? await response.text() : "The notices couldn't be loaded.";
      } catch {
        notices = "The notices couldn't be loaded.";
      }
    }
  }
</script>

<section class="hero">
  <img src="{import.meta.env.BASE_URL}icon.svg" alt="" width="64" height="64" />
  <div>
    <h2>lines</h2>
    <p class="version">Version {version}</p>
    <p class="tagline">Beautiful, simple, local-first notes.</p>
  </div>
</section>

<section>
  <p class="prose">Made by Oleksandr Litus at Overtio.</p>
  <div class="links">
    <button class="text-button" onclick={() => openExternal(REPO)}>
      <Icon name="code" size={15} /> Source on GitHub
    </button>
    <button class="text-button" onclick={() => openExternal(`${REPO}/issues`)}>
      <Icon name="message-circle" size={15} /> Report an issue
    </button>
  </div>
</section>

<section>
  <h3>License</h3>
  <p class="prose">
    lines is free software under the
    <button class="link" onclick={() => openExternal(`${REPO}/blob/main/LICENSE`)}
      >GNU Affero General Public License v3.0</button
    >. You may use, study, share and change it under its terms. If you offer a modified version to others over a
    network, you must make its source available to them as well.
  </p>
</section>

<section>
  <h3>Open source</h3>
  <p class="prose">lines is built on these projects, with thanks to everyone who works on them.</p>
  <ul class="credits">
    {#each CREDITS as credit (credit.name)}
      <li>
        <button class="link" onclick={() => openExternal(credit.url)}>{credit.name}</button>
        <span>{credit.license}</span>
      </li>
    {/each}
  </ul>
  <p class="prose">
    SF Symbols belong to Apple. In the Mac and iPhone apps, macOS and iOS draw them on your device; they aren't
    included in lines.
  </p>
  <button class="text-button flush notices-toggle" onclick={toggleNotices} aria-expanded={noticesOpen}>
    <Icon name="chevron-right" size={14} />
    {noticesOpen ? "Hide" : "Show"} all third-party licenses
  </button>
  {#if noticesOpen}
    <pre class="notices">{notices ?? "Loading…"}</pre>
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
    justify-content: space-between;
    gap: 8px;
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
