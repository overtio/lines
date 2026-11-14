import { hostIsPublic, isTauri, webFetch } from "./platform";

/*
 * Asking the web for what something there named (a feed, a page, its pictures and icons). The apps
 * can reach this computer and the network it's on, as web pages can't, so there an address from
 * the web at large is never followed onto them: not by a redirect, nor by a name that stands for
 * one of their addresses (`127.0.0.1.nip.io`, which the system is asked about: src-tauri's
 * addresses.rs). An address that's on them to begin with (a feed you run yourself) is asked as it is.
 */

/** How many redirects are followed, as browsers do. */
const REDIRECTS = 10;
const REDIRECT = new Set([301, 302, 303, 307, 308]);

/** A request something on the web led to this computer or its network, which isn't made. */
export class LocalAddress extends Error {}

/**
 * Whether a site's name is this computer's, or one on its network, by the name alone: `localhost`,
 * `printer`, `nas.local`, `192.168.1.10`, `[::1]`.
 */
export function isLocal(host: string): boolean {
  const name = host.toLowerCase();
  // A name with a dot in it (not `localhost`, nor an IPv6 address, `[::1]`) that isn't a local network's.
  if (!/^[^[\]]+\.[^.]+$/.test(name) || /\.(?:local|localhost|internal|home|lan)$/.test(name)) return true;
  const ipv4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(name);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * `fetch` for an address something on the web gave. In the apps, each redirect is followed here, and
 * none of the addresses on the way may be on this computer or its network, by name or by what the
 * name stands for, unless the first already was. Elsewhere, the browser's own.
 */
export async function outsideFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const fetch = await webFetch();
  if (!isTauri) return fetch(url, init);
  const guarded = !isLocal(new URL(url).hostname);
  let { method } = init;
  for (let redirects = 0; ; redirects++) {
    const { host, hostname } = new URL(url);
    if (guarded && (isLocal(hostname) || !(await hostIsPublic(hostname)))) throw new LocalAddress(`${host} is on this computer or its network`);
    // The plugin's own option (src-tauri: tauri-plugin-http), which isn't fetch's.
    const response = await fetch(url, { ...init, method, maxRedirections: 0 } as RequestInit);
    const location = REDIRECT.has(response.status) ? response.headers.get("location") : null;
    if (!location) return response;
    if (redirects === REDIRECTS) throw new TypeError("too many redirects");
    void response.body?.cancel().catch(() => {});
    url = new URL(location, url).href;
    if (response.status === 303 && method !== "HEAD") method = "GET";
  }
}
