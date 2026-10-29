import { ICONS, type IconName } from "../icons/icons";

const KEY = "lines.tagIcons";

function read(): Record<string, IconName> {
  try {
    const raw: Record<string, unknown> = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return Object.fromEntries(
      Object.entries(raw).filter(([, icon]) => typeof icon === "string" && icon in ICONS),
    ) as Record<string, IconName>;
  } catch {
    return {};
  }
}

/** The icon chosen for each tag, saved on this device. Tags without one show a #. */
class TagIcons {
  #icons = $state(read());

  get(tag: string): IconName {
    return this.#icons[tag] ?? "hash";
  }

  set(tag: string, icon: IconName) {
    if (icon === "hash") delete this.#icons[tag];
    else this.#icons[tag] = icon;
    this.#save();
  }

  /**
   * Moves the icons of a renamed tag and the tags nested under it. Renamed onto a tag that has
   * its own icon, that one stays.
   */
  rename(from: string, to: string) {
    const moves = (tag: string) => tag === from || tag.startsWith(from + "/");
    const kept = Object.entries(this.#icons).filter(([tag]) => !moves(tag));
    const moved = Object.entries(this.#icons)
      .filter(([tag]) => moves(tag))
      .map(([tag, icon]) => [to + tag.slice(from.length), icon] as const);
    this.#icons = Object.fromEntries([...moved, ...kept]);
    this.#save();
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.#icons));
    } catch {
      // Private mode or full storage: icons just won't persist.
    }
  }
}

export const tagIcons = new TagIcons();
