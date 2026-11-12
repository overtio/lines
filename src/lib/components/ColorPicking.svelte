<script lang="ts">
  // Picking colors (Settings → Theme): while it's on, right-clicking anything (or its menu key)
  // opens the colors it's drawn in, to change, rather than its menu. Changes show at once and wait
  // to be saved in Settings → Theme (themes/drafts.svelte.ts); a bar says it's on, and how many.
  import { Popover } from "bits-ui";
  import { t } from "../i18n/index.svelte";
  import { plugins } from "../plugins/registry.svelte";
  import { menuPoint, pointAt } from "../popover";
  import { prefs } from "../prefs.svelte";
  import { other } from "../themes/css";
  import { themeDrafts } from "../themes/drafts.svelte";
  import { paletteOf, type Scheme } from "../themes/palette";
  import { addingTo, swatchesOf } from "../themes/paletteSwatches";
  import { colorsAt, type FoundColor } from "../themes/picking";
  import { shownScheme } from "../themes/show.svelte";
  import { ui } from "../ui.svelte";
  import { openSettings } from "../windows/settings.svelte";
  import { colorName } from "./settings/colorNames";
  import Button from "./ui/Button.svelte";
  import ColorField from "./ui/ColorField.svelte";
  import { floating } from "./ui/styles";

  const uid = $props.id();
  const theme = $derived(plugins.theme(prefs.windowLook.theme));
  const changed = $derived(themeDrafts.count(theme.id));

  /** Where the right-click was, the colors there, and the scheme they're the theme's colors for. */
  let picked = $state<{ x: number; y: number; colors: FoundColor[]; scheme: Scheme } | null>(null);
  let panel = $state<HTMLElement | null>(null);
  /** The part being changed, outlined while its colors are open. */
  let outline = $state<DOMRect | null>(null);

  /** A dark pane (Settings → Theme → Dark panes) shows the theme's other scheme; a theme with only one has its changes in that. */
  function schemeAt(target: Element): Scheme {
    if (theme.scheme) return theme.scheme;
    const { own } = shownScheme(theme);
    return target.closest("[data-pane][data-scheme]") ? other(own) : own;
  }

  function oncontextmenu(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element) || panel?.contains(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    picked = { ...menuPoint(event, target), colors: colorsAt(target), scheme: schemeAt(target) };
    outline = target.getBoundingClientRect();
  }

  $effect(() => {
    if (!themeDrafts.picking) return;
    addEventListener("contextmenu", oncontextmenu, true);
    return () => removeEventListener("contextmenu", oncontextmenu, true);
  });

  function close() {
    picked = null;
    outline = null;
  }

  const draft = $derived(picked && themeDrafts.of(theme.id)?.[picked.scheme]);
  /** The palette the colors here are the theme's for: offered first, and added to if it's yours. */
  const palette = $derived(picked ? plugins.palette(paletteOf(theme.definition, picked.scheme)) : undefined);
</script>

<!-- Out of the way while Settings shows over the notes. -->
{#if themeDrafts.picking && !ui.settings}
  <div
    role="status"
    class="{floating} fixed bottom-4 left-1/2 flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-wrap items-center gap-x-3 gap-y-1.5 py-1.5 pr-1.5 pl-3.5 text-sm text-fg"
  >
    <span>{changed ? t("picking.changed", { count: changed }) : t("picking.hint")}</span>
    <div class="flex items-center gap-1">
      {#if changed}<Button variant="quiet" onclick={() => void openSettings("theme")}>{t("picking.save")}</Button>{/if}
      <Button variant="primary" onclick={() => ((themeDrafts.picking = false), close())}>{t("picking.done")}</Button>
    </div>
  </div>
{/if}

{#if outline}
  <div
    class="pointer-events-none fixed z-40 rounded-sm outline-2 outline-offset-1 outline-accent outline-dashed"
    style:left="{outline.left}px"
    style:top="{outline.top}px"
    style:width="{outline.width}px"
    style:height="{outline.height}px"
    aria-hidden="true"
  ></div>
{/if}

<Popover.Root open={!!picked} onOpenChange={(open) => !open && close()}>
  <Popover.Portal>
    <Popover.Content
      bind:ref={panel}
      customAnchor={picked && pointAt(picked.x, picked.y)}
      align="start"
      sideOffset={4}
      collisionPadding={8}
      role="dialog"
      aria-labelledby="{uid}-title"
      class="{floating} w-max max-w-[calc(100vw-16px)] p-3"
    >
      <p id="{uid}-title" class="m-0 mb-2.5 text-xs font-semibold text-muted">{t("picking.title", { theme: theme.name })}</p>
      {#if picked?.colors.length}
        <div class="grid grid-cols-[auto_auto] items-center gap-x-5 gap-y-2">
          {#each picked.colors as { key, shown } (key)}
            {@const label = colorName(key)}
            <label for="{uid}-{key}" class="text-sm text-fg">{label}</label>
            <ColorField
              id="{uid}-{key}"
              {label}
              value={draft?.[key]}
              swatch={draft?.[key] ?? shown}
              placeholder={shown}
              optional
              swatches={swatchesOf(palette)}
              onadd={addingTo(palette)}
              onchange={(value) => themeDrafts.set(theme.id, picked!.scheme, key, value)}
            />
          {/each}
        </div>
      {:else}
        <p class="m-0 text-sm text-muted">{t("picking.none")}</p>
      {/if}
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
