# BSVAPI

A pay-per-call AI API. You send a request, the server answers `402 Payment Required` with a price in satoshis and a
BSV address. You pay that address, send the request again with the transaction id, and get the answer. The endpoints
follow the OpenAI request and response shapes where they can.

Behind the API the server calls upstream providers: xAI (Grok) for chat, with optional OpenRouter models as fallbacks;
Atlas Cloud for images and video; Replicate for transcription and music. Prices are the upstream cost multiplied by
`MARKUP_MULTIPLIER`, converted to satoshis at the current BSV/USD rate.

There is also a small account system (email and password) with API keys and a prepaid credit balance, plus an admin
page.

## Endpoints

| Endpoint | Pays with | What it does |
|---|---|---|
| `GET /api/v1/models` | free | Chat models and services on offer |
| `GET /api/v1/services` | free | Fixed-price services with USD prices |
| `POST /api/v1/price` | free | Price quote: `{ model, messages }` or `{ service, units }` |
| `POST /api/v1/chat/completions` | BSV or API key | Chat (OpenAI-compatible, `stream` supported) |
| `POST /api/v1/images/generate` | BSV or API key | One image: `{ prompt, model?, width?, height? }` |
| `POST /api/v1/video/generate` | BSV or API key | Starts a video job: `{ prompt, model?, image_url?, duration? }` |
| `POST /api/v1/transcriptions` | BSV or API key | Whisper: `{ audio_url, language? }` |
| `POST /api/v1/music/generate` | BSV or API key | MusicGen: `{ prompt, duration? }` (max 30 s) |

Chat model ids come from `GET /api/v1/models`. The aliases `b/chat`, `b/fast` and `b/smart` try a list of models in
order and fall back to the next one on outages (see `lib/router.ts`).

## How payment works

1. Call a paid endpoint with no payment. The reply is `402` with a JSON body (`satoshisRequired`, a breakdown) and
   headers:
   - `x-bsv-payment-satoshis-required`
   - `x-bsv-payment-address` (the server's receiving address)
   - `x-bsv-payment-network` (`mainnet`)
2. Broadcast a transaction that pays at least that many satoshis to that address.
3. Repeat the same request with the header `x-bsv-payment: <txid>` (or `{"txid":"<txid>"}`).
4. The server looks the transaction up on WhatsOnChain, adds up the outputs to its address, and checks the total
   covers the price. Each txid can be used once (stored in `bsvapi_used_txids`). If the upstream call then fails, the
   txid is released so you can retry with the same payment.

For chat, the price covers an output budget, and `max_tokens` is capped to that budget.

With an API key instead (`Authorization: Bearer bsvapi_sk_...`), the price is taken from the account's credit balance
before the call and refunded if the upstream call fails. Non-streaming chat is then charged for the tokens actually
used.

## Self-hosting

Requirements: Node 18+, pnpm, a Postgres database with the Supabase REST API in front of it (self-hosted Supabase or
Supabase cloud), and keys for whichever upstream providers you want to offer.

1. Install:
   ```bash
   pnpm install
   ```
2. Create the tables and functions:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
   ```
3. Configure. Copy `.env.example` to `.env.local` and fill it in. The server reads:

   | Variable | Needed for |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Everything (database) |
   | `JWT_SECRET` | Sign-in sessions. At least 32 characters (`openssl rand -hex 32`); the server refuses to sign or check sessions without it |
   | `BSVAPI_HOT_WALLET_ADDRESS` | The address callers pay. Only the address; keep its private key offline. `pnpm tsx scripts/generate-hot-wallet.ts` makes a new one |
   | `XAI_API_KEY`, `XAI_BASE_URL` | Grok chat models |
   | `OPENROUTER_API_KEY` | OpenRouter fallback models (optional) |
   | `ANTHROPIC_API_KEY` | Reserved for the router; no Anthropic models are listed yet |
   | `ATLASCLOUD_API_KEY`, `ATLASCLOUD_URL` | Images and video |
   | `REPLICATE_API_TOKEN` | Transcription and music |
   | `ADMIN_API_KEY` | Optional bearer key for `/admin`; ignored unless at least 32 characters. Without it, only signed-in users with `is_admin = true` can use the admin routes |
   | `MARKUP_MULTIPLIER` | Price multiplier over upstream cost (default 2) |

4. Run:
   ```bash
   pnpm dev      # development
   pnpm build && pnpm start
   ```

Rate limits are counted per IP using the first `x-forwarded-for` entry. Vercel sets that header itself. Behind any
other proxy, make sure the proxy overwrites the header rather than appending to it, or callers can pick their own IP.

## Rebuild

The plan is to remove the server-side money entirely:

- each paid call is paid from the caller's own wallet (x402, approved in the bWalletX payment sheet, or any BRC-100
  wallet),
- no stored balances and no API-key credit accounts,
- no server hot wallet receiving user funds: each call's payment goes straight to the payee named in that call's
  402 offer, bound to that one request.

Until then the current payment flow above is what the code does.

## Security

Please report security problems privately to: `SECURITY CONTACT: owner to fill in before publishing`.
Do not open a public issue for a vulnerability.

Known limits of the current design (being addressed in the rebuild):

- A payment is a bare txid. It is not bound to a particular request or caller, so someone watching the receiving
  address could submit another caller's txid first. Unconfirmed (0-conf) transactions are accepted.
- Transcription is charged one minute regardless of audio length; video and music are flat-priced per call.
- API keys are stored in the database as plain text.
- Credit changes use compare-and-swap from the app. A database function with a `credits_sats >= 0` check would be
  stronger.

## Licence

Open BSV License version 4. See [LICENSE](LICENSE).
