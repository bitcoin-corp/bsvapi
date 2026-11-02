-- BSVAPI initial schema
--
-- Reconstructed from the tables and RPC the runtime code expects.
-- Safe to run against an empty database or an existing one; every
-- CREATE uses IF NOT EXISTS so re-applying is a no-op.
--
-- Apply with psql against your Postgres / Supabase database:
--   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
--
-- Or from the Supabase Studio SQL editor by pasting the contents.

-- ---------------------------------------------------------------------
-- bsvapi_users — account-holder records
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bsvapi_users (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text          NOT NULL UNIQUE,
  password_hash   text          NOT NULL,
  name            text,
  credits_sats    bigint        NOT NULL DEFAULT 0,
  is_admin        boolean       NOT NULL DEFAULT false,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bsvapi_users_email_idx ON bsvapi_users (lower(email));

-- ---------------------------------------------------------------------
-- bsvapi_api_keys — authenticated access tokens per user
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bsvapi_api_keys (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid          NOT NULL REFERENCES bsvapi_users (id) ON DELETE CASCADE,
  key               text          NOT NULL UNIQUE,
  name              text          NOT NULL,
  tier              text          NOT NULL DEFAULT 'standard',
  discount_percent  numeric(5,2)  NOT NULL DEFAULT 0,
  active            boolean       NOT NULL DEFAULT true,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bsvapi_api_keys_user_idx ON bsvapi_api_keys (user_id);
CREATE INDEX IF NOT EXISTS bsvapi_api_keys_key_active_idx
  ON bsvapi_api_keys (key) WHERE active = true;

-- ---------------------------------------------------------------------
-- bsvapi_usage — per-call audit log of chat, image, video, audio requests
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bsvapi_usage (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid          REFERENCES bsvapi_users (id) ON DELETE SET NULL,
  api_key_id     uuid          REFERENCES bsvapi_api_keys (id) ON DELETE SET NULL,
  model          text          NOT NULL,
  input_tokens   integer       NOT NULL DEFAULT 0,
  output_tokens  integer       NOT NULL DEFAULT 0,
  cost_sats      bigint        NOT NULL DEFAULT 0,
  cost_usd       numeric(12,6) NOT NULL DEFAULT 0,
  payment_txid   text,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bsvapi_usage_user_created_idx
  ON bsvapi_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bsvapi_usage_key_created_idx
  ON bsvapi_usage (api_key_id, created_at DESC);

-- ---------------------------------------------------------------------
-- bsvapi_used_txids — replay protection for BSV-paid anonymous calls
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bsvapi_used_txids (
  txid        text          PRIMARY KEY,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- bsvapi_credit_txns — every credit addition or deduction for a user
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bsvapi_credit_txns (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid          NOT NULL REFERENCES bsvapi_users (id) ON DELETE CASCADE,
  amount_sats    bigint        NOT NULL,
  txid           text,
  reason         text          NOT NULL,
  balance_after  bigint        NOT NULL,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bsvapi_credit_txns_user_idx
  ON bsvapi_credit_txns (user_id, created_at DESC);

-- ---------------------------------------------------------------------
-- bsvapi_rate_limits — sliding-window rate counters keyed by (ip or token, window_start)
--
-- Column name is `window_start` rather than `window` to avoid the
-- PostgreSQL reserved keyword, and to match the table that was
-- originally deployed by hand before this migration was versioned.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bsvapi_rate_limits (
  key           text          NOT NULL,
  window_start  timestamptz   NOT NULL,
  count         integer       NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS bsvapi_rate_limits_window_idx
  ON bsvapi_rate_limits (window_start);

-- ---------------------------------------------------------------------
-- bsvapi_increment_rate_limit(p_key text, p_window timestamptz)
--   Atomic UPSERT + increment of the counter. Returns the new count.
--   Called by lib/rate-limit.ts on every request. The parameter is
--   still named p_window because the TypeScript caller passes that
--   key name; internally it maps to the window_start column.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bsvapi_increment_rate_limit(
  p_key     text,
  p_window  timestamptz
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO bsvapi_rate_limits (key, window_start, count)
  VALUES (p_key, p_window, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = bsvapi_rate_limits.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;

-- ---------------------------------------------------------------------
-- Housekeeping helper: purge expired rate-limit rows older than 1 day.
-- Call from a cron (pg_cron) or manually.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bsvapi_purge_rate_limits()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM bsvapi_rate_limits
  WHERE window_start < now() - interval '1 day';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
