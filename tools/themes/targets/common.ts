import type { Theme } from "../../../src/lib/plugins/types";
import { SCHEMES } from "../../../src/lib/themes/file";

/** The schemes a theme has colors of its own for: the one it has, or both. */
export const schemesOf = (theme: Theme) => (theme.scheme ? [theme.scheme] : SCHEMES);

/** What a target writes: each file's path in its folder, and its text (or JSON, written out). */
export type Written = Record<string, string | object>;

/** A name as a file name: "Green World" as "green-world". */
export const slug = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "theme";
