import { propertyValue } from "../notes/escape";
import { type Property, propertyOf, setProperties } from "../notes/properties";

/*
 * Streams: feeds grouped by topic or priority ("Must read", "Work", "Later"), named on their
 * subscriptions' notes as `stream:`, a list for a feed in several (`stream: Must read, Work`), so
 * they sync as notes do. A stream is the name its feeds have: one with none isn't one.
 */

/** Two names are one stream whatever their case and spaces, as tags are one whatever their case. */
export const streamKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** A stream's name as it's typed: on one line, and without the commas that part the list it's written in. */
export const cleanStream = (name: string) => name.replace(/[,\n]/g, " ").replace(/\s+/g, " ").trim();

/** The streams a note's `stream:` names, each once (a YAML list's items read as one value, joined by commas). */
export function streamsOf(properties: Property[]): string[] {
  return withStream([], (propertyOf(properties, "stream")?.value ?? "").split(","));
}

/** `streams` with these added, each that isn't there already. */
export function withStream(streams: string[], added: string[]): string[] {
  const all = [...streams];
  for (const name of added.map(cleanStream)) if (name && !all.some((each) => streamKey(each) === streamKey(name))) all.push(name);
  return all;
}

/** `streams` without `name`'s. */
export const withoutStream = (streams: string[], name: string) => streams.filter((each) => streamKey(each) !== streamKey(name));

/** A note's text with its streams as these, written as any outside text is (a `#later` isn't a tag); with none, its `stream:` taken off. */
export const writeStreams = (body: string, streams: string[]) => setProperties(body, { stream: streams.length ? propertyValue(streams.join(", ")) : null });
