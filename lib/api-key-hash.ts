import crypto from "crypto";

/**
 * API keys are stored as sha256(key) only (hex), never in plaintext. The full key is shown to its owner once, at
 * creation; afterwards only key_prefix (for recognising it) is visible.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

/** Constant-time comparison of two hex sha256 digests. */
export function apiKeyHashMatches(storedHash: string | null | undefined, presentedKey: string): boolean {
  if (typeof storedHash !== "string" || !/^[0-9a-f]{64}$/.test(storedHash)) return false;
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashApiKey(presentedKey), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** What the dashboard shows after creation: enough to recognise the key, useless to use it. */
export function apiKeyPrefix(key: string): string {
  return `${key.slice(0, Math.min(key.length - 8, 24))}…`;
}
