import { AwsClient } from "aws4fetch";
import { t } from "../i18n/index.svelte";
import { isTauri, webFetch } from "../platform";
import { SyncError, type Remote, type RemoteObject } from "./remote";

/** Any S3-compatible bucket: Amazon S3, Cloudflare R2, Backblaze B2, MinIO, … */
export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  /** Folder inside the bucket, e.g. `lines/`. */
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const unquote = (etag: string | null) => etag?.replace(/^(W\/)?"|"$/g, "") ?? null;

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Buckets found this session not to do conditional writes, though they don't ignore them: written to as before. */
const unconditional = new Set<string>();

export class S3Remote implements Remote {
  #client: AwsClient;
  #base: string;

  constructor(readonly config: S3Config) {
    this.#client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region || "auto",
      service: "s3",
    });
    // Path-style URLs work across S3, R2, B2 and MinIO.
    this.#base = `${config.endpoint.replace(/\/+$/, "")}/${encodeURIComponent(config.bucket)}`;
  }

  /** A failure is thrown as an error, but for the statuses in `answers` (404: there's nothing there). */
  async #request(path: string, init: RequestInit = {}, answers = [404]) {
    // In the browser the bucket must allow this app's origin (CORS).
    const doFetch = await webFetch();
    const signed = await this.#client.sign(this.#base + path, init);
    let response: Response;
    try {
      response = await doFetch(signed);
    } catch (error) {
      console.error("lines: storage request failed", error);
      throw new SyncError(
        isTauri ? t("sync.error.unreachableApp") : t("sync.error.unreachableBrowser"),
      );
    }
    if (!response.ok && !answers.includes(response.status)) {
      const text = await response.text().catch(() => "");
      const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
      const message = /<Message>([^<]+)<\/Message>/.exec(text)?.[1];
      throw new SyncError(
        code === "SignatureDoesNotMatch" || code === "InvalidAccessKeyId"
          ? t("sync.error.wrongKey")
          : code === "NoSuchBucket"
            ? t("sync.error.noBucket", { bucket: this.config.bucket })
            : code === "AccessDenied" || response.status === 403
              ? t("sync.error.denied")
              : // The status as text, so it isn't written as a number ("1 000").
                message
                ? t("sync.error.service", { status: String(response.status), message })
                : t("sync.error.status", { status: String(response.status) }),
      );
    }
    return response;
  }

  /** Every object under `prefix`, following pagination. */
  async list(prefix: string): Promise<RemoteObject[]> {
    const objects: RemoteObject[] = [];
    let token: string | null = null;
    do {
      const params = new URLSearchParams({ "list-type": "2", prefix });
      if (token) params.set("continuation-token", token);
      const response = await this.#request(`?${params}`);
      if (response.status === 404) throw new SyncError(t("sync.error.noBucket", { bucket: this.config.bucket }));
      const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
      // Anything else (a proxy's login page, a misconfigured endpoint) would read as an empty bucket.
      if (xml.documentElement.localName !== "ListBucketResult") {
        throw new SyncError(t("sync.error.notS3"));
      }
      for (const item of xml.getElementsByTagName("Contents")) {
        const key = item.getElementsByTagName("Key")[0]?.textContent;
        const etag = unquote(item.getElementsByTagName("ETag")[0]?.textContent ?? null);
        if (key && etag) objects.push({ key, etag });
      }
      const truncated = xml.getElementsByTagName("IsTruncated")[0]?.textContent === "true";
      token = truncated ? (xml.getElementsByTagName("NextContinuationToken")[0]?.textContent ?? null) : null;
    } while (token);
    return objects;
  }

  async get(key: string): Promise<{ text: string; etag: string | null } | null> {
    const response = await this.#request(`/${encodeKey(key)}`);
    if (response.status === 404) return null;
    return { text: await response.text(), etag: unquote(response.headers.get("etag")) };
  }

  /** Returns the new ETag, if the server exposes it. */
  async put(key: string, text: string, expected?: string | null) {
    return this.#put(key, text, "text/markdown; charset=utf-8", expected);
  }

  async getFile(key: string) {
    const response = await this.#request(`/${encodeKey(key)}`);
    return response.status === 404 ? null : response.blob();
  }

  async putFile(key: string, data: Blob) {
    await this.#put(key, data, data.type || "application/octet-stream");
  }

  /** Conditional (If-Match, or If-None-Match for a new object) where `expected` is given. A service that ignores that writes anyway, as before. */
  async #put(key: string, body: string | Blob, contentType: string, expected?: string | null): Promise<string | null | false> {
    if (unconditional.has(this.#base)) expected = undefined;
    const condition: Record<string, string> = expected === undefined ? {} : expected === null ? { "if-none-match": "*" } : { "if-match": `"${expected}"` };
    const response = await this.#request(
      `/${encodeKey(key)}`,
      { method: "PUT", body, headers: { "content-type": contentType, ...condition } },
      expected === undefined ? [404] : [404, 409, 412, 501],
    );
    // Another device wrote it since (409: just as this was written). Unless it's still as expected,
    // and the service can't do conditional writes after all: it would never be written then.
    if (response.status === 409 || (response.status === 412 && (await this.#etag(key)) !== expected)) return false;
    if (response.status === 412 || response.status === 501) {
      unconditional.add(this.#base);
      return this.#put(key, body, contentType);
    }
    return unquote(response.headers.get("etag"));
  }

  /** The object's ETag now, or null if it isn't there. From the listing where the bucket doesn't show the header to this page (CORS). */
  async #etag(key: string) {
    const response = await this.#request(`/${encodeKey(key)}`, { method: "HEAD" });
    if (response.status === 404) return null;
    return unquote(response.headers.get("etag")) ?? (await this.list(key)).find((object) => object.key === key)?.etag ?? null;
  }

  async delete(key: string) {
    await this.#request(`/${encodeKey(key)}`, { method: "DELETE" });
  }
}
