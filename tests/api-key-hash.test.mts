// Run: node --test tests/   (Node >= 22.18 strips TypeScript types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { hashApiKey, apiKeyHashMatches, apiKeyPrefix } from "../lib/api-key-hash.ts";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const KEY = "bsvapi_sk_test_" + "0123456789abcdef0123456789abcdef";

test("hash is sha256 hex of the key, and matches only the same key (constant-time compare)", () => {
  assert.equal(hashApiKey(KEY), createHash("sha256").update(KEY).digest("hex"));
  assert.equal(apiKeyHashMatches(hashApiKey(KEY), KEY), true);
  assert.equal(apiKeyHashMatches(hashApiKey(KEY), KEY + "x"), false);
  for (const bad of [null, undefined, "", "zz", hashApiKey(KEY).toUpperCase(), hashApiKey(KEY).slice(1)]) {
    assert.equal(apiKeyHashMatches(bad as string, KEY), false, String(bad));
  }
  assert.match(src("lib/api-key-hash.ts"), /timingSafeEqual/);
});

test("key_prefix is at most 8 characters and shows only the last 4 of the key", () => {
  for (const k of [KEY, "bsvapi_sk_x_" + "f".repeat(32), "short1234"]) {
    const p = apiKeyPrefix(k);
    assert.ok(p.length <= 8, p);
    assert.equal(p, "…" + k.slice(-4));
  }
  const m = src("supabase/migrations/0002_api_key_hash_and_rls.sql");
  assert.match(m, /CHECK \(key_prefix IS NULL OR char_length\(key_prefix\) <= 8\)/);
  assert.match(m, /key_prefix = '…' \|\| right\(key, 4\)/);
});

test("db.ts looks keys up by key_hash only, never stores or returns plaintext or the hash", () => {
  const s = src("lib/db.ts");
  assert.doesNotMatch(s, /\.eq\("key",/);
  assert.match(s, /\.eq\("key_hash", hashApiKey\(apiKey\)\)/);
  assert.match(s, /apiKeyHashMatches\(data\.key_hash, apiKey\)/);
  assert.match(s, /key_hash: hashApiKey\(key\), key_prefix: apiKeyPrefix\(key\)/);
  assert.doesNotMatch(s, /from\("bsvapi_api_keys"\)\s*\.select\("\*"\)/);
  assert.doesNotMatch(s.match(/const CLIENT_COLUMNS = "[^"]*"/)![0], /key_hash|"key,|, key,/);
});

test("routes and pages use the prefix (or the one-time key at creation), never a stored key", () => {
  assert.match(src("app/api/auth/me/route.ts"), /key_prefix: k\.key_prefix/);
  const dash = src("app/dashboard/page.tsx");
  assert.doesNotMatch(dash, /k\.key\b/);
  assert.match(dash, /setFreshKey/);
  for (const r of ["chat/completions", "images/generate", "music/generate", "transcriptions", "video/generate"]) {
    assert.doesNotMatch(src(`app/api/v1/${r}/route.ts`), /client\.key\b/, r);
  }
});

test("migration: part A backfills sha256, RLS + explicit grants on all six tables; part B drops plaintext", () => {
  const m = src("supabase/migrations/0002_api_key_hash_and_rls.sql");
  assert.match(m, /encode\(sha256\(convert_to\(key, 'UTF8'\)\), 'hex'\)/);
  assert.match(m, /ENABLE ROW LEVEL SECURITY/);
  assert.match(m, /REVOKE ALL ON public\.%I FROM anon, authenticated, PUBLIC/);
  assert.match(m, /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.%I TO service_role/);
  for (const t of ["bsvapi_users", "bsvapi_api_keys", "bsvapi_usage", "bsvapi_used_txids", "bsvapi_credit_txns", "bsvapi_rate_limits"]) assert.ok(m.includes(`'${t}'`), t);
  assert.match(m, /-- ALTER TABLE public\.bsvapi_api_keys DROP COLUMN IF EXISTS key;/);
});
