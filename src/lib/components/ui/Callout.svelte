<script lang="ts">
  // A message set apart: what went wrong (announced at once), what worked (announced politely), or a
  // note.
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<HTMLDivElement> & { tone?: "note" | "danger" | "success"; children: Snippet };
  let { tone = "note", class: className, children, ...rest }: Props = $props();

  const tones = {
    note: "bg-input text-muted",
    danger: "bg-danger/12 text-danger",
    success: "bg-success/14 text-success",
  };
</script>

<div
  {...rest}
  role={tone === "danger" ? "alert" : tone === "success" ? "status" : undefined}
  class={["ui-callout rounded-lg px-3 py-2.5 text-sm leading-normal", tones[tone], className]}
  data-tone={tone}
>
  {@render children()}
</div>
