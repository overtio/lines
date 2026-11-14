<script lang="ts">
  // A rating as a row on a shelf shows it, small: its marks (half of one too), its points, or its
  // word, as a note draws it (editor/scores.ts). As written where Little Touches draws scores so.
  import { MARKS, type Scale, type Score, spokenScore } from "../editor/scores";
  import Icon from "../icons/Icon.svelte";
  import { prefs } from "../prefs.svelte";

  let { score, scale, written }: { score: Score | null; scale: Scale; written: string } = $props();

  const icon = $derived(scale.kind === "marks" ? (scale.icon ?? MARKS[prefs.scores === "off" ? "stars" : prefs.scores]) : null);
  /** Stars in the theme's yellow and hearts in its red, as a note has them; others in the accent. */
  const tone = $derived(icon === "star" ? "var(--palette-yellow)" : icon === "heart" ? "var(--palette-red)" : "var(--accent)");
</script>

{#if !score || prefs.scores === "off"}
  <span>{written}</span>
{:else if scale.kind === "marks" && icon}
  <span class="flex items-center gap-px" style:--score={tone} role="img" aria-label={spokenScore(score, scale)}>
    {#each { length: scale.of }, i (i)}
      {@const fill = Math.min(1, Math.max(0, score.score - i))}
      <span class={["relative flex", fill === 1 ? "text-(--score) [&_svg]:fill-current" : "text-faint"]}>
        <Icon name={icon} size={11} />
        {#if fill === 0.5}
          <Icon name={icon} size={11} class="absolute inset-0 fill-current text-(--score) [clip-path:inset(0_50%_0_0)] rtl:[clip-path:inset(0_0_0_50%)]" />
        {/if}
      </span>
    {/each}
  </span>
{:else if scale.kind === "points"}
  <span class="tabular font-semibold text-muted" role="img" aria-label={spokenScore(score, scale)}>{score.score}<span class="font-normal text-faint">/{score.of}</span></span>
{:else if scale.kind === "labels" && scale.icons && score.label}
  <span class="flex text-accent [&_svg]:fill-current" role="img" aria-label={spokenScore(score, scale)}>
    <Icon name={scale.icons[scale.labels.indexOf(score.label)]} size={12} />
  </span>
{:else}
  <span class="font-semibold text-accent">{spokenScore(score, scale)}</span>
{/if}
