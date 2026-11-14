<script lang="ts">
  // Settings → Library → Ratings: what each kind is rated on (lines' own scales, or yours) and the
  // ratings it names besides the overall one, added, renamed, moved and removed; and your own scales.
  // Synced, with tags' and types' looks, in library.json (library/ratings.ts). Notes are never
  // rewritten for a scale: what doesn't fit it shows as written, and this says how many don't.
  import { tick } from "svelte";
  import { speak } from "../../a11y";
  import { scoreIn } from "../../editor/scores";
  import { locale, t } from "../../i18n/index.svelte";
  import Icon from "../../icons/Icon.svelte";
  import { ratingKey, wordsIn } from "../../library/ratings";
  import { OVERALL, ratings, type ScaleChoice } from "../../library/ratings.svelte";
  import { propertyOf } from "../../notes/properties";
  import { notes } from "../../notes/store.svelte";
  import { plugins } from "../../plugins/registry.svelte";
  import type { LibraryKind } from "../../plugins/types";
  import Button from "../ui/Button.svelte";
  import Callout from "../ui/Callout.svelte";
  import FieldGroup from "../ui/FieldGroup.svelte";
  import FieldRow from "../ui/FieldRow.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import Select from "../ui/Select.svelte";
  import TextField from "../ui/TextField.svelte";
  import ScaleEditor from "./ScaleEditor.svelte";

  const id = $props.id();
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const kinds = $derived(plugins.libraryKinds.filter((kind) => ratings.rated(kind.type)));
  const options = $derived(ratings.scales.map((scale) => ({ value: scale.id, label: scale.name })));
  const own = $derived(ratings.scales.filter((scale) => scale.own));

  /** The kind whose named ratings are open to change. */
  let open = $state<string | null>(null);
  /** A named rating being added, as typed. */
  let adding = $state("");
  let error = $state<string | null>(null);
  /** The scale of yours being changed, or "new" for one being made. */
  let editing = $state<string | null>(null);

  /** How many of a kind's notes have a rating its scale can't read, which shows as written. */
  function unfit(type: string) {
    const scale = ratings.scaleOf(type);
    const keys = ratings.of(type).map((rating) => rating.key);
    return notes.ofType(type).filter(({ meta }) =>
      keys.some((key) => {
        const value = propertyOf(meta.properties, key)?.value.trim();
        return value && !scoreIn(value, scale);
      }),
    ).length;
  }

  /** Why `name` can't be one of `kind`'s named ratings (`except` the one it's renaming), if it can't. */
  function wrong(kind: LibraryKind, name: string, except?: string): string | null {
    const others = ratings.named(kind.type).filter((each) => ratingKey(each) !== ratingKey(except ?? ""));
    // Keys lines writes in the kind's notes itself.
    const written = new Set(["type", "link", "status", "progress", OVERALL, ...kind.properties]);
    if (!wordsIn([name], 1, true)) return t("library.rating.nameInvalid");
    if (written.has(ratingKey(name)) || others.some((each) => ratingKey(each) === ratingKey(name))) return t("library.rating.nameTaken", { name: name.trim() });
    return null;
  }

  function add(event: SubmitEvent, kind: LibraryKind) {
    event.preventDefault();
    const name = adding.trim();
    error = wrong(kind, name);
    if (error) return;
    ratings.setNamed(kind.type, [...ratings.named(kind.type), name]);
    adding = "";
    speak(t("library.rating.added", { name }));
  }

  /** Renames one as its field's left (or ↵ pressed in it): in the kind's notes too (ratings.svelte.ts). */
  function rename(event: Event, kind: LibraryKind, from: string) {
    const field = event.currentTarget as HTMLInputElement;
    const to = field.value.trim();
    if (to === from) return;
    error = wrong(kind, to, from);
    if (error) {
      field.value = from;
      return;
    }
    void ratings.rename(kind.type, from, to);
    speak(t("library.rating.renamed", { from, to }));
  }

  async function move(kind: LibraryKind, at: number, by: -1 | 1) {
    const names = [...ratings.named(kind.type)];
    const place = at + by;
    [names[at], names[place]] = [names[place], names[at]];
    ratings.setNamed(kind.type, names);
    speak(t("library.rating.moved", { name: names[place], place: place + 1, count: names.length }));
    // The keyboard stays with the rating moved: on the same arrow, or the other where it's gone as far as it goes.
    await tick();
    const arrow = (way: "up" | "down") => document.getElementById(`${id}-${kind.type}-${place}-${way}`) as HTMLButtonElement | null;
    const same = arrow(by < 0 ? "up" : "down");
    (same?.disabled ? arrow(by < 0 ? "down" : "up") : same)?.focus();
  }

  async function remove(kind: LibraryKind, at: number) {
    const names = ratings.named(kind.type);
    ratings.setNamed(kind.type, names.filter((_, i) => i !== at));
    speak(t("library.rating.removed", { name: names[at] }));
    await tick();
    document.getElementById(`${id}-${kind.type}-add`)?.focus();
  }

  function removeScale(scale: ScaleChoice) {
    ratings.removeScale(scale.id);
    speak(t("library.rating.scaleRemoved", { name: scale.name }));
  }

  /** What a scale of yours is, under its name. */
  function describe({ scale }: ScaleChoice) {
    if (scale.kind === "labels") return t("library.rating.describeWords", { words: scale.labels.join(", ") });
    return t(scale.kind === "marks" ? "library.rating.describeMarks" : "library.rating.describePoints", { of: scale.of });
  }
</script>

<FieldGroup title={t("library.rating.title")} note={t("library.rating.note")}>
  {#each kinds as kind (kind.type)}
    {@const names = ratings.named(kind.type)}
    {@const misfits = unfit(kind.type)}
    <FieldRow
      label={kind.name}
      note={[names.length ? t("library.rating.alsoFor", { names: list.format(names) }) : "", misfits ? t("library.rating.unfit", { count: misfits }) : ""].filter(Boolean).join(" ") || null}
    >
      <Select
        label={t("library.rating.scaleOf", { kind: kind.name })}
        value={ratings.scaleId(kind.type)}
        {options}
        onchange={(scale) => ratings.setScale(kind.type, scale)}
      />
      <IconButton
        icon="square-pen"
        label={t("library.rating.editNamed", { kind: kind.name })}
        open={open === kind.type}
        aria-expanded={open === kind.type}
        aria-controls="{id}-{kind.type}"
        onclick={() => {
          open = open === kind.type ? null : kind.type;
          adding = "";
          error = null;
        }}
      />
      {#snippet below()}
        {#if open === kind.type}
          <div id="{id}-{kind.type}" class="mt-3 flex flex-col gap-1.5" role="group" aria-label={t("library.rating.namedOf", { kind: kind.name })}>
            {#each names as name, at (name)}
              <div class="flex items-center gap-1">
                <TextField
                  class="flex-1"
                  value={name}
                  aria-label={t("library.rating.nameOf", { place: at + 1 })}
                  onchange={(event) => rename(event, kind, name)}
                  onkeydown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                />
                <IconButton id="{id}-{kind.type}-{at}-up" icon="arrow-up" label={t("library.rating.moveUp", { name })} disabled={at === 0} onclick={() => move(kind, at, -1)} />
                <IconButton
                  id="{id}-{kind.type}-{at}-down"
                  icon="arrow-down"
                  label={t("library.rating.moveDown", { name })}
                  disabled={at === names.length - 1}
                  onclick={() => move(kind, at, 1)}
                />
                <IconButton icon="x" label={t("library.rating.remove", { name })} onclick={() => remove(kind, at)} />
              </div>
            {/each}
            <form class="flex items-center gap-2" onsubmit={(event) => add(event, kind)}>
              <TextField id="{id}-{kind.type}-add" class="flex-1" bind:value={adding} aria-label={t("library.rating.newName")} placeholder={t("library.rating.namePlaceholder")} />
              <Button type="submit" icon="plus" disabled={!adding.trim()}>{t("library.rating.add")}</Button>
            </form>
            {#if error}<Callout tone="danger">{error}</Callout>{/if}
            <p class="m-0 text-xs leading-normal text-muted">{t("library.rating.namedNote")}</p>
          </div>
        {/if}
      {/snippet}
    </FieldRow>
  {/each}
</FieldGroup>

{#snippet newScale()}
  <Button variant="quiet" icon="plus" onclick={() => (editing = "new")} disabled={editing === "new"}>{t("library.rating.newScale")}</Button>
{/snippet}

<FieldGroup title={t("library.rating.scales")} note={t("library.rating.scalesNote")} action={newScale}>
  {#if editing === "new"}<ScaleEditor onclose={() => (editing = null)} />{/if}
  {#each own as scale (scale.id)}
    {#if editing === scale.id}
      <ScaleEditor {scale} onclose={() => (editing = null)} />
    {:else}
      {@const users = ratings.usedBy(scale.id)}
      <FieldRow label={scale.name} note={describe(scale)}>
        {#if scale.scale.kind === "marks" && scale.scale.icon}<Icon name={scale.scale.icon} size={16} class="text-accent" />{/if}
        <IconButton icon="square-pen" label={t("library.rating.editScale", { name: scale.name })} onclick={() => (editing = scale.id)} />
        <IconButton
          icon="trash"
          label={t("library.rating.removeScale", { name: scale.name })}
          tooltip={users.length ? t("library.rating.scaleInUse", { kinds: list.format(users.map((type) => plugins.libraryKind(type)?.name ?? type)) }) : undefined}
          disabled={users.length > 0}
          onclick={() => removeScale(scale)}
        />
      </FieldRow>
    {/if}
  {:else}
    {#if editing !== "new"}<p class="m-0 px-4 py-3 text-sm text-muted">{t("library.rating.noScales")}</p>{/if}
  {/each}
</FieldGroup>
