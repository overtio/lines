import { isTauri } from "./platform";
import { REPO, VERSION } from "./release";

type Fetch = typeof fetch;

let nativeFetch: Promise<Fetch> | undefined;

/**
 * `fetch`, made through Rust in the native apps: there a server needs no CORS setup for lines, and
 * the apps' content security policy lets the page itself reach only lines. In the browser it's a
 * plain fetch, which the server must allow.
 */
export async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!isTauri) return fetch(input, init);
  nativeFetch ??= import("@tauri-apps/plugin-http").then((m) => m.fetch as Fetch);
  return (await nativeFetch)(input, init);
}

/** How lines names itself to the services it asks for things, some of which want to know (nekos.best). */
const USER_AGENT = `lines/${VERSION} (${REPO})`;

/** GETs JSON, throwing if the request fails. Browsers name themselves, so only the apps add lines' name. */
export async function getJSON<T>(url: string): Promise<T> {
  const response = await request(url, isTauri ? { headers: { "User-Agent": USER_AGENT } } : undefined);
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return (await response.json()) as T;
}

/** Web images trying again, one after another. */
let retrying = Promise.resolve();

/**
 * Loads the web image `src` into `img`, trying twice more if it fails, a moment apart and one image
 * at a time: some servers turn away a page asking for several at once (OtakuGIFs' answers one
 * request at a time). Calls `failed` once it gives up.
 */
export function loadImage(img: HTMLImageElement, src: string, failed: () => void) {
  let tries = 0;
  img.addEventListener("error", () => {
    if (++tries > 2) return failed();
    retrying = retrying.then(
      () =>
        new Promise<void>((done) => {
          setTimeout(() => {
            if (!img.isConnected) return done();
            img.addEventListener("load", () => done(), { once: true });
            img.addEventListener("error", () => done(), { once: true });
            img.src = src;
          }, 400 * tries);
        }),
    );
  });
  img.src = src;
}
