<script lang="ts">
  // On or off, as `checked` says: a change refused (or failed) leaves it as it was. Sized in pixels:
  // the thumb travels exactly the track's width less its own. The transparent borders are what
  // forced colors (Windows' contrast themes) draws it with, as it drops the backgrounds.
  import { Switch, type SwitchRootProps } from "bits-ui";

  type Props = Omit<SwitchRootProps, "checked" | "onCheckedChange" | "onchange"> & { checked: boolean; onchange: (on: boolean) => void; label: string };
  let { checked, onchange, label, disabled = false, ...rest }: Props = $props();
</script>

<Switch.Root
  {...rest}
  bind:checked={() => checked, onchange}
  {disabled}
  aria-label={label}
  class="touch-target inline-flex h-5 w-[34px] shrink-0 items-center rounded-full border border-transparent bg-ink/15 p-px transition-colors data-[state=checked]:bg-accent data-disabled:opacity-45"
>
  <Switch.Thumb
    class="pointer-events-none block size-4 rounded-full border border-transparent bg-[#fff] shadow-segment transition-transform duration-200 ease-pop data-[state=checked]:translate-x-[14px]"
  />
</Switch.Root>
