import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";

const SCREENSHOT_KEY = /^screenshots\/[A-Za-z0-9_-]+\.jpe?g$/;

function storageConfig() {
  const endpoint = process.env.STORAGE_ENDPOINT?.replace(/\/$/, "");
  const bucket = process.env.STORAGE_BUCKET;
  const region = process.env.STORAGE_REGION || "auto";
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}

export function isObjectStorageConfigured() {
  return storageConfig() !== null;
}

function client() {
  const cfg = storageConfig();
  if (!cfg) return null;
  return {
    cfg,
    s3: new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: false,
    }),
  };
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

/** Public app URL that proxies the private bucket object. */
export function publicFileUrl(key: string) {
  const base = appBaseUrl();
  const path = `/api/files/${key}`;
  return base ? `${base}${path}` : path;
}

export function isAllowedScreenshotKey(key: string) {
  return SCREENSHOT_KEY.test(key);
}

function parseDataUrl(dataUrl: string): {
  contentType: string;
  buffer: Buffer;
} | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    dataUrl,
  );
  if (!match) return null;
  const contentType =
    match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  try {
    return {
      contentType,
      buffer: Buffer.from(match[2].replace(/\s/g, ""), "base64"),
    };
  } catch {
    return null;
  }
}

/**
 * Persist a browser-captured screenshot. Prefers Railway/S3 object storage;
 * falls back to a small data URL for local dev without bucket credentials.
 */
export async function storeScreenshot(
  dataUrl: string,
): Promise<string | undefined> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    if (/^https?:\/\//i.test(dataUrl)) return dataUrl;
    return undefined;
  }

  // Soft cap: reject huge payloads even before upload (~900KB binary)
  if (parsed.buffer.byteLength > 900_000) {
    return undefined;
  }

  const wired = client();
  if (!wired) {
    // Local / missing bucket: keep compact data URLs only
    if (dataUrl.length <= 400_000) return dataUrl;
    return undefined;
  }

  const ext = parsed.contentType === "image/png" ? "png" : "jpg";
  const key = `screenshots/${nanoid(24)}.${ext}`;

  await wired.s3.send(
    new PutObjectCommand({
      Bucket: wired.cfg.bucket,
      Key: key,
      Body: parsed.buffer,
      ContentType: parsed.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return publicFileUrl(key);
}

export async function getStoredObject(key: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
} | null> {
  if (!isAllowedScreenshotKey(key)) return null;
  const wired = client();
  if (!wired) return null;

  const result = await wired.s3.send(
    new GetObjectCommand({
      Bucket: wired.cfg.bucket,
      Key: key,
    }),
  );

  if (!result.Body) return null;
  const bytes = await result.Body.transformToByteArray();

  return {
    bytes,
    contentType: result.ContentType || "image/jpeg",
  };
}
