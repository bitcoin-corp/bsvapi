-- 0002_api_key_hash_and_rls.sql: API keys stored as sha256 only; RLS + explicit grants on every bsvapi table.
--
-- NOT RUN. Shared DB (`postgres`). Run as `postgres` (owner of the bsvapi_* tables) in ONE psql session with
-- ON_ERROR_STOP. TWO PARTS, around the deploy of fix/api-key-hash:
--   PART A (before the deploy): add key_hash + key_prefix, backfill them from the existing key, RLS + grants.
--          Old code (reads `key`) and new code (reads `key_hash`) both work after part A.
--   PART B (after the new code is live and an existing key has been seen working): drop the plaintext `key` column.
--
-- RLS: 0001_init.sql created every bsvapi table with no RLS and Supabase's default browser grants. Live today
--   (17 Nov) RLS is on everywhere; bsvapi_api_keys and bsvapi_users already lost their browser grants (bit-sign
--   #761), but the other four still grant anon + authenticated every privilege (no policy, so RLS blocks rows, but
--   not the privileges RLS does not govern). This makes it explicit and repeatable: RLS on, browsers revoked,
--   service_role (the app's key) granted what it uses.
--
-- ROLLBACK (part A): ALTER TABLE public.bsvapi_api_keys DROP COLUMN key_hash, DROP COLUMN key_prefix;
--   (RLS stays on; re-grant browsers only if something proves it needs them.) Part B cannot be rolled back: the
--   plaintext is gone, and every key keeps working through key_hash. That is the point.
-- VERIFY:
--   SELECT count(*) FILTER (WHERE key_hash IS NULL), count(*) FROM public.bsvapi_api_keys;          -- 0, n
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE 'bsvapi%' AND relkind = 'r';     -- all t
--   SELECT relname FROM pg_class c, aclexplode(c.relacl) a WHERE c.relname LIKE 'bsvapi%'
--     AND a.grantee::regrole::text IN ('anon', 'authenticated');                                    -- 0 rows

-- ============================== PART A ==============================
BEGIN;

DO $precheck$
DECLARE t text;
BEGIN
    IF current_database() <> 'postgres' THEN
        RAISE EXCEPTION 'precheck: connected to %, expected the shared DB postgres', current_database();
    END IF;
    FOREACH t IN ARRAY ARRAY['bsvapi_users', 'bsvapi_api_keys', 'bsvapi_usage', 'bsvapi_used_txids', 'bsvapi_credit_txns', 'bsvapi_rate_limits'] LOOP
        IF pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = format('public.%I', t)::regclass)) <> current_user THEN
            RAISE EXCEPTION 'precheck: % is not owned by % (a non-owner REVOKE is silently ignored)', t, current_user;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t) THEN
            RAISE EXCEPTION 'precheck: % has a policy; review it before revoking browser access', t;
        END IF;
    END LOOP;
END
$precheck$;

ALTER TABLE public.bsvapi_api_keys
    ADD COLUMN IF NOT EXISTS key_hash text,
    ADD COLUMN IF NOT EXISTS key_prefix text;

-- Backfill from the plaintext while it still exists (part B removes the column). key_prefix matches
-- lib/api-key-hash.ts apiKeyPrefix(): the first min(len - 8, 24) characters plus an ellipsis.
DO $backfill$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'bsvapi_api_keys' AND column_name = 'key') THEN
        EXECUTE $q$
            UPDATE public.bsvapi_api_keys
               SET key_hash = encode(sha256(convert_to(key, 'UTF8')), 'hex'),
                   key_prefix = left(key, least(length(key) - 8, 24)) || '…'
             WHERE key IS NOT NULL AND key_hash IS NULL
        $q$;
        -- New rows carry no plaintext: let `key` be NULL until part B drops it.
        EXECUTE 'ALTER TABLE public.bsvapi_api_keys ALTER COLUMN key DROP NOT NULL';
    END IF;
END
$backfill$;

ALTER TABLE public.bsvapi_api_keys ALTER COLUMN key_hash SET NOT NULL;
ALTER TABLE public.bsvapi_api_keys
    DROP CONSTRAINT IF EXISTS bsvapi_api_keys_key_hash_format,
    ADD CONSTRAINT bsvapi_api_keys_key_hash_format CHECK (key_hash ~ '^[0-9a-f]{64}$');
CREATE UNIQUE INDEX IF NOT EXISTS bsvapi_api_keys_key_hash_key ON public.bsvapi_api_keys (key_hash);

-- RLS + explicit grants on every bsvapi table. No browser role needs any of them (server-only, service key).
DO $grants$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['bsvapi_users', 'bsvapi_api_keys', 'bsvapi_usage', 'bsvapi_used_txids', 'bsvapi_credit_txns', 'bsvapi_rate_limits'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated, PUBLIC', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
    END LOOP;
END
$grants$;

COMMIT;

-- ============================== PART B ==============================
-- Run ONLY after fix/api-key-hash is live and an API call with an existing key has succeeded.
-- BEGIN;
-- DO $b$ BEGIN
--     IF EXISTS (SELECT 1 FROM public.bsvapi_api_keys WHERE key_hash IS NULL) THEN
--         RAISE EXCEPTION 'part B: a key has no key_hash; run part A first';
--     END IF;
-- END $b$;
-- ALTER TABLE public.bsvapi_api_keys DROP COLUMN IF EXISTS key;   -- also drops its UNIQUE and the key_active index
-- COMMIT;
