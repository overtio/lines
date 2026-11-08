import { t } from "../../lib/i18n/index.svelte";

/*
 * A worker that does the page's long jobs one at a time (running OpenSCAD, reading a STEP file),
 * started the first time it's needed and kept. One that takes too long is stopped, and the next job
 * starts it again.
 */
export class Jobs<In, Out> {
  #worker: Worker | null = null;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly start: () => Worker,
    /** How long a job may take, in milliseconds. */
    private readonly limit: number,
  ) {}

  run(job: In, transfer: Transferable[] = []): Promise<Out> {
    const done = this.#queue.then(() => this.#run(job, transfer));
    this.#queue = done.catch(() => {});
    return done;
  }

  #run(job: In, transfer: Transferable[]) {
    const worker = (this.#worker ??= this.start());
    return new Promise<Out>((resolve, reject) => {
      const fail = (message: string) => {
        clearTimeout(timer);
        worker.terminate();
        this.#worker = null;
        reject(new Error(message));
      };
      const timer = setTimeout(() => fail(t("models.tooLong")), this.limit);
      worker.onmessage = ({ data }: MessageEvent<Out | { error: string }>) => {
        clearTimeout(timer);
        if (data && typeof data === "object" && "error" in data) reject(new Error(data.error));
        else resolve(data);
      };
      worker.onerror = (event) => fail(event.message || t("models.failed"));
      worker.postMessage(job, transfer);
    });
  }
}
