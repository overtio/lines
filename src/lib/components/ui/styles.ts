// Classes for parts Bits UI draws (menus, a select's options, popovers), which take a class rather
// than one of our components.

/** A panel floating over the app: a menu, a select's options, a popover. */
export const floating = "z-50 rounded-lg border border-line bg-panel shadow-menu outline-none animate-pop-in";

/** One choice in a floating list, lit when pointed at or reached by the keyboard. */
export const option =
  "flex h-row w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-sm whitespace-nowrap text-fg outline-none select-none data-highlighted:bg-active data-disabled:cursor-default data-disabled:opacity-45 [&_.icon]:text-muted coarse:text-md";

/** A line between groups of choices. */
export const separator = "mx-2 my-1 h-px bg-line";
