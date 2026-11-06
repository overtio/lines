/*
 * Saying things to screen readers that happen out of sight: "Copied", a sync problem, a note moved
 * to the trash. One polite live region for the whole window, so messages queue rather than
 * interrupt each other (docs/accessibility.md).
 */

let region: HTMLElement | undefined;

/** Has screen readers say `message`, after whatever they're saying. */
export function speak(message: string) {
  if (!region) {
    region = document.createElement("div");
    region.className = "sr-only";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("role", "status");
    document.body.append(region);
  }
  // Cleared first, so the same message twice in a row is said twice.
  region.textContent = "";
  const target = region;
  setTimeout(() => (target.textContent = message), 50);
}
