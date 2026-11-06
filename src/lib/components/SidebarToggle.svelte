<script lang="ts">
  import { slide } from "svelte/transition";
  import { t } from "../i18n/index.svelte";
  import { reducedMotion } from "../platform";
  import { prefs } from "../prefs.svelte";
  import { ui } from "../ui.svelte";
  import IconButton from "./ui/IconButton.svelte";

  /** The button that shows the sidebar, where `ui.sidebarToggle` puts it, with the sidebar's side in its icon. */
</script>

<!-- `sidebar-toggle` is where App.svelte gives focus back when the sidebar hides. -->
<div class="flex shrink-0" transition:slide={{ axis: "x", duration: reducedMotion.matches ? 0 : 200 }}>
  <IconButton
    class="sidebar-toggle"
    icon={prefs.sidebarSide === "left" ? "panel-left" : "panel-right"}
    label={t("list.showSidebar")}
    onclick={() => ui.toggleSidebar()}
  />
</div>
