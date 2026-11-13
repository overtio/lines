/** Resolves after `ms`, or rejects once `signal` aborts. */
export const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

/**
 * Requests to a service that asks to be called once at a time and no more often than every
 * `spacing` ms (arXiv, MusicBrainz): each task waits for the one before it to finish, and for its turn.
 */
export function pacing(spacing: number) {
  let last = 0;
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> => {
    const turn = queue.then(async () => {
      signal.throwIfAborted();
      await pause(last + spacing - Date.now(), signal);
      last = Date.now();
      return task();
    });
    queue = turn.catch(() => {});
    return turn;
  };
}
