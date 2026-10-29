import type { DriveId } from "./folder";
import type { S3Config } from "./s3";
import type { LibraryKey } from "./sealed";

export type ProviderId = "r2" | "b2" | "s3" | "other";

/** An S3-compatible bucket. Saved configs from before folders existed have no `kind`. */
export interface BucketConfig extends S3Config {
  kind?: "bucket";
  provider: ProviderId;
  /** Set once the notes there are encrypted end to end and this device has their key. */
  encryption?: LibraryKey;
}

/** A cloud drive folder on this computer (desktop apps). Notes go in `<path>/notes/`. */
export interface FolderConfig {
  kind: "folder";
  provider: DriveId;
  /** Shown in Settings, e.g. "iCloud Drive". */
  name: string;
  path: string;
  encryption?: LibraryKey;
}

export type SyncConfig = BucketConfig | FolderConfig;

export const isFolder = (config: SyncConfig): config is FolderConfig => config.kind === "folder";

export const PROVIDERS: Record<ProviderId, { name: string; endpoint: string; help: string }> = {
  r2: {
    name: "Cloudflare R2",
    endpoint: "https://<account-id>.r2.cloudflarestorage.com",
    help: "In R2, open “Manage API tokens” and create an Object Read & Write token for this bucket.",
  },
  b2: {
    name: "Backblaze B2",
    endpoint: "https://s3.us-west-004.backblazeb2.com",
    help: "In Application Keys, add a key with Read and Write access to this bucket. The endpoint is shown on the bucket page.",
  },
  s3: {
    name: "Amazon S3",
    endpoint: "https://s3.us-east-1.amazonaws.com",
    help: "Use an IAM key limited to this bucket: s3:ListBucket, s3:GetObject, s3:PutObject and s3:DeleteObject.",
  },
  other: {
    name: "Other",
    endpoint: "https://s3.example.com",
    help: "Any S3-compatible storage: MinIO, Wasabi, Tigris, DigitalOcean Spaces, Garage, Hetzner…",
  },
};

/** Fill in the region from the endpoint where providers encode it. */
export function inferRegion(provider: ProviderId, endpoint: string): string {
  if (provider === "r2") return "auto";
  const b2 = /s3\.([a-z0-9-]+)\.backblazeb2\.com/i.exec(endpoint);
  if (b2) return b2[1];
  const aws = /s3[.-]([a-z0-9-]+)\.amazonaws\.com/i.exec(endpoint);
  if (aws && aws[1] !== "external-1") return aws[1];
  return "us-east-1";
}

/** Whether two configs are the same bucket folder, or the same drive folder. */
export function sameLocation(a: SyncConfig, b: SyncConfig) {
  if (isFolder(a) || isFolder(b)) return isFolder(a) && isFolder(b) && a.path === b.path;
  return a.endpoint === b.endpoint && a.bucket === b.bucket && a.prefix === b.prefix;
}

export function normalizeConfig(config: SyncConfig): SyncConfig {
  if (isFolder(config)) return { ...config, path: config.path.trim().replace(/\/+$/, "") };
  let endpoint = config.endpoint.trim().replace(/\/+$/, "");
  if (endpoint && !/^https?:\/\//i.test(endpoint)) endpoint = `https://${endpoint}`;
  let prefix = config.prefix.trim().replace(/^\/+/, "");
  if (prefix && !prefix.endsWith("/")) prefix += "/";
  return {
    ...config,
    endpoint,
    prefix,
    bucket: config.bucket.trim(),
    accessKeyId: config.accessKeyId.trim(),
    secretAccessKey: config.secretAccessKey.trim(),
    region: config.region.trim() || inferRegion(config.provider, endpoint),
  };
}
