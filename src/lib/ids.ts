import { nanoid } from "nanoid";
import { createHash, randomBytes } from "crypto";

export function newId(prefix?: string) {
  const id = nanoid(16);
  return prefix ? `${prefix}_${id}` : id;
}

export function newToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey() {
  const secret = randomBytes(24).toString("base64url");
  const key = `pln_${secret}`;
  return {
    key,
    prefix: key.slice(0, 11),
    hash: hashApiKey(key),
  };
}

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "workspace"
  );
}
