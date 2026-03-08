# BSVAPI.com

Money in. Content out.

Pay-per-call API access to AI models using BSV micropayments. No accounts, no subscriptions, no API keys.

## Architecture

```
Client → POST /api/v1/chat/completions
       ← 402 Payment Required (price in satoshis)
       → Pays BSV, retries with x-bsv-payment header
       ← AI response (proxied from Grok)
```

Uses BRC-0105 HTTP Service Monetization protocol.

## Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/v1/models` | None | List available models |
| `POST /api/v1/price` | None | Get price estimate |
| `POST /api/v1/chat/completions` | BSV payment | Chat completions (OpenAI-compatible) |

## Development

```bash
cp .env.example .env.local  # Add your XAI_API_KEY
pnpm install
pnpm dev
```

## Stack

- Next.js 15 (App Router)
- TypeScript
- BRC-0105 (BSV micropayments)
- xAI/Grok (upstream AI provider)

A [Bitcoin Corporation](https://bitcoin-corp.com) service.
