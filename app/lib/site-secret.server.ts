// The password or access key that puts guides live on a client's website (lib/site-publish.server.ts), locked with
// AES-256-GCM before it is saved. The key is GEO_SITE_KEY, else one made from the database address (so set
// GEO_SITE_KEY before changing the database password, or the saved logins must be typed again).

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.GEO_SITE_KEY || createHmac("sha256", process.env.DATABASE_URL || "geo-dev").update("geo:site-link").digest("hex");
  return createHash("sha256").update(raw).digest();
}

/** Lock a password or key for saving. */
export function lock(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

/** Unlock a saved password or key. Throws when the server's key changed since it was saved. */
export function unlock(saved: string): string {
  const [v, iv, tag, body] = saved.split(".");
  if (v !== "v1" || !iv || !tag || !body) throw new Error("The saved login can’t be read. Connect the website again.");
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
  } catch {
    throw new Error("The saved login can’t be read any more (the server’s key changed). Connect the website again.");
  }
}
