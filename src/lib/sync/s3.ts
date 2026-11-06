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

  async #request(path: string, init: RequestInit = {}) {
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
    if (!response.ok && response.status !== 404) {
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
  async put(key: string, text: string | Blob, contentType = "text/markdown; charset=utf-8") {
    const response = await this.#request(`/${encodeKey(key)}`, {
      method: "PUT",
      body: text,
      headers: { "content-type": contentType },
    });
    return unquote(response.headers.get("etag"));
  }

  async getFile(key: string) {
    const response = await this.#request(`/${encodeKey(key)}`);
    return response.status === 404 ? null : response.blob();
  }

  async putFile(key: string, data: Blob) {
    await this.put(key, data, data.type || "application/octet-stream");
  }

  async delete(key: string) {
    await this.#request(`/${encodeKey(key)}`, { method: "DELETE" });
  }
}
