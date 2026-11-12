import { mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { Written } from "./targets/common";

/** Writes each file under `folder`, and says where. */
export async function save(folder: string, files: Written) {
  for (const [path, contents] of Object.entries(files)) {
    const file = join(folder, path);
    await mkdir(dirname(file), { recursive: true });
    await Bun.write(file, typeof contents === "string" ? contents : `${JSON.stringify(contents, null, 2)}\n`);
    const shown = relative(process.cwd(), file);
    console.log(`  ${shown.startsWith("..") ? file : shown}`);
  }
}

/** Runs a command's `main`, saying what went wrong, without a stack, if it fails. */
export function run(main: () => Promise<void>) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
