<script lang="ts">
  // Sharing something of yours as a file (a theme, a palette, a preset): through the system's share
  // sheet where it takes files, copied as text to paste into a message, or saved.
  import { DropdownMenu } from "bits-ui";
  import { speak } from "../../a11y";
  import { t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { copyText } from "../../platform";
  import { saveAndShow } from "../../save";
  import IconButton from "../ui/IconButton.svelte";
  import { floating, option } from "../ui/styles";

  let {
    label,
    copyLabel,
    copied,
    downloadLabel,
    file,
  }: {
    label: string;
    copyLabel: string;
    /** Said once it's copied. */
    copied: string;
    downloadLabel: string;
    /** The file, made when it's shared. */
    file: () => { name: string; text: string };
  } = $props();

  // Where the share sheet takes files (Safari, the Mac and phone apps), it's offered too.
  const canShareFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [new File(["{}"], "shared.json", { type: "application/json" })] });

  function share() {
    const { name, text } = file();
    void navigator.share({ files: [new File([text], name, { type: "application/json" })] }).catch(() => {});
  }

  async function copy() {
    await copyText(file().text);
    speak(copied);
  }

  function download() {
    const { name, text } = file();
    void saveAndShow(name, async () => new TextEncoder().encode(text), "application/json");
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <IconButton {...props} icon="share" {label} />
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} aria-label={label} class="{floating} min-w-[200px] p-[5px]">
      {#if canShareFiles}
        <DropdownMenu.Item class={option} onSelect={share}>
          <Icon name="share" size={15} />{t("app.shareSheet")}
        </DropdownMenu.Item>
      {/if}
      <DropdownMenu.Item class={option} onSelect={() => void copy()}>
        <Icon name="copy" size={15} />{copyLabel}
      </DropdownMenu.Item>
      <DropdownMenu.Item class={option} onSelect={download}>
        <Icon name="download" size={15} />{downloadLabel}
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
