/** Rejects once `signal` aborts, with its reason; to race against, so it's nothing unhandled when it aborts after. */
function aborted(signal: AbortSignal) {
  const rejects = new Promise<never>((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  rejects.catch(() => {});
  return rejects;
}

/** Resolves after `ms`, or rejects once `signal` aborts. */
export const pause = (ms: number, signal: AbortSignal) =>
  ms <= 0 ? Promise.resolve() : Promise.race([new Promise<void>((resolve) => setTimeout(resolve, ms)), aborted(signal)]);

/**
 * `signal`, and aborting by itself after `ms` too, so a request that never answers doesn't hold up
 * what waits for it. (As `AbortSignal.any` with `AbortSignal.timeout`, which older WebKit lacks.)
 */
export function withTimeout(signal: AbortSignal, ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("It took too long", "TimeoutError")), ms);
  const stop = () => controller.abort(signal.reason);
  if (signal.aborted) stop();
  else signal.addEventListener("abort", stop, { once: true });
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return controller.signal;
}

/**
 * Requests to a service that asks to be called once at a time and no more often than every
 * `spacing` ms (arXiv, MusicBrainz): each task waits for the one before it to finish, and for its
 * turn; one whose signal aborts meanwhile rejects at once, without waiting for its turn.
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
    return Promise.race([turn, aborted(signal)]);
  };
}
