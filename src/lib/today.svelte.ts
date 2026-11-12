import { type Day, dayOf } from "./notes/calendar";

/** Today, so what shows it ("Today" in the list, the Calendar's count) rolls over at midnight, even if the app sits idle. */
class Today {
  #day = $state<Day>(dayOf(Date.now()));

  constructor() {
    this.#tick();
    // Timers stall while a laptop sleeps.
    document.addEventListener("visibilitychange", () => (this.#day = dayOf(Date.now())));
  }

  #tick() {
    this.#day = dayOf(Date.now());
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    setTimeout(() => this.#tick(), midnight.getTime() - Date.now() + 1000);
  }

  get day(): Day {
    return this.#day;
  }
}

export const today = new Today();
