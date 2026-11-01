import { priceFor, listChatModels } from "./router";

// Upstream costs per 1M tokens (USD)
// Chat model prices live in lib/router.ts (MODELS); aliases are priced at their dearest candidate.

const MARKUP = parseFloat(process.env.MARKUP_MULTIPLIER || "2");

// Fixed-price services (USD per request)
const SERVICE_PRICING: Record<string, { usd: number; description: string }> = {
  // AtlasCloud — images (real upstream costs, pre-markup)
  "image-sdxl": { usd: 0.01, description: "z-image/turbo image generation" },
  "image-flux": { usd: 0.032, description: "seedream-v5.0-lite image generation" },
  // AtlasCloud — video
  "video-wan": { usd: 0.15, description: "Wan 2.1 text/image-to-video" },
  "video-kling": { usd: 0.30, description: "Kling video generation" },
  // Replicate
  "whisper": { usd: 0.006, description: "Whisper large-v3 transcription (per minute)" },
  "music-gen": { usd: 0.05, description: "MusicGen audio generation" },
};

// BSV/USD rate — updated periodically
let bsvUsdRate = 0;
let rateLastUpdated = 0;

export async function getBsvUsdRate(): Promise<number> {
  const now = Date.now();
  if (bsvUsdRate > 0 && now - rateLastUpdated < 5 * 60 * 1000) {
    return bsvUsdRate;
  }

  try {
    const res = await fetch(
      "https://api.coinbase.com/v2/prices/BSV-USD/spot"
    );
    const data = await res.json();
    bsvUsdRate = parseFloat(data.data.amount);
    rateLastUpdated = now;
    return bsvUsdRate;
  } catch {
    // Fallback: try WhatsOnChain
    try {
      const res = await fetch(
        "https://api.whatsonchain.com/v1/bsv/main/exchangerate"
      );
      const data = await res.json();
      bsvUsdRate = data.rate || 50;
      rateLastUpdated = now;
      return bsvUsdRate;
    } catch {
      return bsvUsdRate || 50; // last known or rough fallback
    }
  }
}

/**
 * Estimate cost in satoshis for a chat completion request.
 * We estimate input tokens from the message content and
 * budget for a generous output token count.
 */
export async function estimateCostSats(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ satoshis: number; usdCost: number; breakdown: string }> {
  const pricing = priceFor(model);
  if (!pricing) {
    throw new Error(`Unsupported model: ${model}. Available: ${listChatModels().map((m) => m.id).join(", ")}`);
  }

  // Rough token estimate: ~4 chars per token
  const inputChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const estimatedInputTokens = Math.max(Math.ceil(inputChars / 4), 100);
  // Budget for output: assume up to 2x input or minimum 500 tokens
  const estimatedOutputTokens = Math.max(estimatedInputTokens * 2, 500);

  const inputCostUsd = (estimatedInputTokens / 1_000_000) * pricing.input * MARKUP;
  const outputCostUsd = (estimatedOutputTokens / 1_000_000) * pricing.output * MARKUP;
  const totalUsd = inputCostUsd + outputCostUsd;

  const rate = await getBsvUsdRate();
  const bsvAmount = totalUsd / rate;
  const satoshis = Math.ceil(bsvAmount * 1e8);

  // Minimum 500 sats per call to cover tx fees
  const finalSats = Math.max(satoshis, 500);

  return {
    satoshis: finalSats,
    usdCost: totalUsd,
    breakdown: `~${estimatedInputTokens} input + ~${estimatedOutputTokens} output tokens @ ${MARKUP}x markup`,
  };
}

/**
 * Calculate actual cost after seeing real token usage from upstream.
 */
export async function actualCostSats(
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  const pricing = priceFor(model);
  if (!pricing) return 0;

  const inputCostUsd = (inputTokens / 1_000_000) * pricing.input * MARKUP;
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.output * MARKUP;
  const totalUsd = inputCostUsd + outputCostUsd;

  const rate = await getBsvUsdRate();
  const bsvAmount = totalUsd / rate;
  return Math.max(Math.ceil(bsvAmount * 1e8), 500);
}

export async function getServiceCostSats(
  service: string,
  units: number = 1
): Promise<{ satoshis: number; usdCost: number; description: string }> {
  const pricing = SERVICE_PRICING[service];
  if (!pricing) {
    throw new Error(
      `Unknown service: ${service}. Available: ${Object.keys(SERVICE_PRICING).join(", ")}`
    );
  }
  const totalUsd = pricing.usd * MARKUP * units;
  const rate = await getBsvUsdRate();
  const satoshis = Math.max(Math.ceil((totalUsd / rate) * 1e8), 100);
  return { satoshis, usdCost: totalUsd, description: pricing.description };
}

export function getSupportedServices(): Array<{
  id: string;
  description: string;
  usdPerUnit: number;
}> {
  return Object.entries(SERVICE_PRICING).map(([id, p]) => ({
    id,
    description: p.description,
    usdPerUnit: p.usd * MARKUP,
  }));
}

export function getSupportedModels(): Array<{
  id: string;
  type: string;
  provider: string;
}> {
  const models = listChatModels().map((m) => ({ id: m.id, type: "chat", provider: m.provider }));
  const services = Object.keys(SERVICE_PRICING).map((id) => ({
    id,
    type: id.startsWith("image")
      ? "image"
      : id.startsWith("video")
        ? "video"
        : id === "whisper"
          ? "transcription"
          : "audio",
    provider:
      id.startsWith("image") || id.startsWith("video")
        ? "atlascloud"
        : "replicate",
  }));
  return [...models, ...services];
}
