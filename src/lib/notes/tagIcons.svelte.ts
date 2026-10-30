import { ICONS, type IconName } from "../icons/icons";

function read(key: string): Record<string, IconName> {
  try {
    const raw: Record<string, unknown> = JSON.parse(localStorage.getItem(key) ?? "{}");
    return Object.fromEntries(
      Object.entries(raw).filter(([, icon]) => typeof icon === "string" && icon in ICONS),
    ) as Record<string, IconName>;
  } catch {
    return {};
  }
}

/** The icon chosen for each tag (or type), saved on this device. Those without one show `fallback`'s. */
class ChosenIcons {
  #key: string;
  #fallback: (name: string) => IconName;
  #icons = $state<Record<string, IconName>>({});

  constructor(key: string, fallback: (name: string) => IconName) {
    this.#key = key;
    this.#fallback = fallback;
    this.#icons = read(key);
  }

  get(name: string): IconName {
    return this.#icons[name] ?? this.#fallback(name);
  }

  /** The icon chosen for it, if one was. */
  chosen(name: string): IconName | undefined {
    return this.#icons[name];
  }

  /** Every choice, as a string; reading it in an effect reruns the effect when any changes. */
  signature() {
    return JSON.stringify(this.#icons);
  }

  /** Chooses its icon; null (or its fallback) goes back to the fallback. */
  set(name: string, icon: IconName | null) {
    if (!icon || icon === this.#fallback(name)) delete this.#icons[name];
    else this.#icons[name] = icon;
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
      localStorage.setItem(this.#key, JSON.stringify(this.#icons));
    } catch {
      // Private mode or full storage: icons just won't persist.
    }
  }
}

/** Tags without an icon of their own show a #. */
export const tagIcons = new ChosenIcons("lines.tagIcons", () => "hash");

/** Icons that suit types people often use, until another is chosen. */
const TYPE_ICONS: Record<string, IconName> = {
  person: "user",
  people: "users",
  contact: "user",
  friend: "user",
  team: "users",
  company: "building-2",
  organization: "building-2",
  organisation: "building-2",
  project: "briefcase",
  meeting: "calendar",
  event: "calendar",
  book: "book",
  article: "newspaper",
  paper: "file-text",
  place: "map-pin",
  location: "map-pin",
  city: "map-pin",
  trip: "plane",
  recipe: "utensils",
  movie: "film",
  film: "film",
  album: "music",
  song: "music",
  product: "package",
  device: "laptop",
  car: "car",
  task: "square-check",
  idea: "lightbulb",
};

/** The icon of each type (`type: person`, see properties.ts). */
export const typeIcons = new ChosenIcons("lines.typeIcons", (type) => TYPE_ICONS[type] ?? "shapes");
