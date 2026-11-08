<script lang="ts">
  // A secret in a note, `{{github}}`: its name and dots, with buttons to show it for a moment and to
  // copy it. Either asks for the locked notes' password first while they're closed. Styled by
  // editor.css (.cm-secret).
  import { onDestroy } from "svelte";
  import { speak } from "../../lib/a11y";
  import { t } from "../../lib/i18n/index.svelte";
  import Icon from "../../lib/icons/Icon.svelte";
  import { secrets } from "../../lib/notes/secrets.svelte";
  import { copyText } from "../../lib/platform";

  let { name }: { name: string } = $props();

  /** How long a shown secret stays shown. */
  const SHOWN_FOR = 15_000;
  const DOTS = "••••••";

  let shown = $state(false);
  let copied = $state(false);
  let hiding: ReturnType<typeof setTimeout> | undefined;
  let uncopying: ReturnType<typeof setTimeout> | undefined;

  // Hidden again as soon as its note locks.
  const value = $derived(shown ? secrets.get(name) : undefined);
  const missing = $derived(!secrets.closed && secrets.get(name) === undefined);

  /** Its value, opening locked notes first if need be; says so if there's none. */
  async function find() {
    const found = await secrets.find(name);
    if (found === undefined && !secrets.closed) speak(t("secrets.missing", { name }));
    return found;
  }

  async function toggle() {
    clearTimeout(hiding);
    if (shown) return void (shown = false);
    if ((await find()) === undefined) return;
    shown = true;
    hiding = setTimeout(() => (shown = false), SHOWN_FOR);
  }

  async function copy() {
    const found = await find();
    if (found === undefined) return;
    void copyText(found);
    speak(t("editor.copied"));
    copied = true;
    clearTimeout(uncopying);
    uncopying = setTimeout(() => (copied = false), 1200);
  }

  onDestroy(() => {
    clearTimeout(hiding);
    clearTimeout(uncopying);
  });
</script>

<span class={["cm-secret", missing && "is-missing", value !== undefined && "is-shown"]} title={missing ? t("secrets.missing", { name }) : t("secrets.label", { name })}>
  <span class="cm-secret-icon" aria-hidden="true"><Icon name="key" size={12} strokeWidth={2.25} /></span>
  <span class="cm-secret-name">{name}</span>
  <span class="cm-secret-value" aria-live="polite">{value ?? DOTS}</span>
  <button
    type="button"
    class="cm-secret-button"
    aria-label={value !== undefined ? t("secrets.hide", { name }) : t("secrets.show", { name })}
    aria-pressed={value !== undefined}
    title={value !== undefined ? t("secrets.hide", { name }) : t("secrets.show", { name })}
    onmousedown={(event) => event.preventDefault()}
    onclick={toggle}
  >
    <Icon name={value !== undefined ? "eye-off" : "eye"} size={13} strokeWidth={2} />
  </button>
  <button
    type="button"
    class={["cm-secret-button", copied && "is-copied"]}
    aria-label={t("secrets.copy", { name })}
    title={t("secrets.copy", { name })}
    onmousedown={(event) => event.preventDefault()}
    onclick={copy}
  >
    <Icon name={copied ? "check" : "copy"} size={13} strokeWidth={2} />
  </button>
</span>
