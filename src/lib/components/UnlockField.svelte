<script lang="ts">
  import Icon from "../icons/Icon.svelte";

  /*
   * A lock's password field (the app's, a locked note's), with the arrow that sends it once
   * something's typed, and why it didn't work under it. It shakes on a wrong password.
   */
  let {
    value = $bindable(""),
    input = $bindable(),
    label,
    placeholder,
    go,
    going,
    error,
    errorId,
    busy,
    shakes,
    autofocus = false,
  }: {
    value?: string;
    input?: HTMLInputElement;
    label: string;
    placeholder: string;
    /** The arrow's name, and what it says while it works. */
    go: string;
    going: string;
    error: string | null;
    errorId: string;
    busy: boolean;
    /** Bumped on a wrong password, to shake the field again. */
    shakes: number;
    /** Focused as soon as it shows, not only after a wrong password. */
    autofocus?: boolean;
  } = $props();
</script>

{#key shakes}
  <div class="relative w-full" class:shake={shakes > 0}>
    <!-- The accent at full strength, two pixels wide, so focus shows (3:1) in place of the outline. -->
    <input
      bind:this={input}
      bind:value
      type="password"
      {placeholder}
      aria-label={label}
      aria-invalid={!!error}
      aria-describedby={error ? errorId : undefined}
      autocomplete="current-password"
      disabled={busy}
      class="h-10 w-full rounded-lg border border-line bg-panel pr-11 pl-3.5 font-[inherit] text-md text-fg outline-none transition-[border-color,box-shadow] aria-invalid:not-focus:border-danger/55 focus:border-accent focus:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_color-mix(in_srgb,var(--accent)_12%,transparent)] coarse:h-[50px] coarse:pr-14"
      {@attach (node) => void ((autofocus || shakes > 0) && node.focus())}
    />
    <button
      type="submit"
      disabled={!value || busy}
      aria-label={busy ? going : go}
      class="absolute top-[5px] right-[5px] grid size-[30px] place-items-center rounded-md bg-accent text-on-accent transition-opacity disabled:pointer-events-none disabled:opacity-0 coarse:top-[3px] coarse:right-[3px] coarse:size-11"
    >
      <Icon name={busy ? "loader" : "chevron-right"} size={18} class={busy ? "animate-spin" : ""} />
    </button>
  </div>
{/key}

<p class="m-0 mt-2 mb-1 min-h-[1.5em] text-sm leading-normal text-danger" id={errorId} role="alert">{error ?? ""}</p>

<style>
  .shake {
    animation: shake 360ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }

  @keyframes shake {
    20%,
    60% {
      transform: translateX(-7px);
    }
    40%,
    80% {
      transform: translateX(7px);
    }
  }
</style>
