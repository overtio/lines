import { lockedNotes } from "./locked.svelte";
import { frontMatter } from "./properties";
import { notes } from "./store.svelte";

/*
 * Secrets: API keys, tokens and passwords, kept in a locked note of type `secrets`, whose
 * properties are the secrets, by name (docs/secrets.md). Locked notes are encrypted here and
 * wherever they sync, so the values are only ever readable while locked notes are open. Notes and
 * requests use a secret by its name, `{{github}}`, and never hold its value.
 */

/** The type that makes a locked note a secrets note. */
export const SECRETS_TYPE = "secrets";

const isSecretsNote = (body: string) => frontMatter(body)?.properties.some(({ key, value }) => key === "type" && value.trim().toLowerCase() === SECRETS_TYPE);

class Secrets {
  /** The secrets in the open secrets notes, by name; the oldest note's, where two have the same name. */
  readonly #open = $derived.by(() => {
    const found = new Map<string, string>();
    const open = notes.entries
      .map(({ note }) => note)
      .filter((note) => note.locked?.open && !note.trashed && isSecretsNote(note.body))
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const note of open) {
      for (const { key, value } of frontMatter(note.body)!.properties) {
        if (key !== "type" && !found.has(key)) found.set(key, value);
      }
    }
    return found;
  });

  /** Whether some locked notes are closed, so a secret that isn't found may be in one. */
  readonly closed = $derived(notes.entries.some(({ note }) => note.locked && !note.locked.open && !note.trashed));

  /** A secret's value, if a secrets note that's open has it. */
  get(name: string): string | undefined {
    return this.#open.get(name);
  }

  /** The names of the secrets that can be read now. */
  get names(): string[] {
    return [...this.#open.keys()];
  }

  /** Opens locked notes, asking for their password (or Touch ID); whether they opened. */
  open(): Promise<boolean> {
    if (!this.closed) return Promise.resolve(true);
    return new Promise((resolve) => {
      lockedNotes.asking = { purpose: "open", reason: "secret", after: () => resolve(true), cancelled: () => resolve(false) };
    });
  }

  /** A secret's value, opening locked notes first if it may be in one that's closed; undefined if there's none. */
  async find(name: string): Promise<string | undefined> {
    if (this.get(name) === undefined && this.closed) await this.open();
    return this.get(name);
  }
}

export const secrets = new Secrets();
