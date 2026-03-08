// Upstream costs per 1M tokens (USD)
const UPSTREAM_PRICING: Record<string, { input: number; output: number }> = {
  "grok-3": { input: 3, output: 15 },
  "grok-3-mini": { input: 0.30, output: 0.50 },
  "grok-2": { input: 2, output: 10 },
};

const MARKUP = parseFloat(process.env.MARKUP_MULTIPLIER || "2");

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
  const pricing = UPSTREAM_PRICING[model];
  if (!pricing) {
    throw new Error(`Unsupported model: ${model}. Available: ${Object.keys(UPSTREAM_PRICING).join(", ")}`);
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
  const pricing = UPSTREAM_PRICING[model];
  if (!pricing) return 0;

  const inputCostUsd = (inputTokens / 1_000_000) * pricing.input * MARKUP;
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.output * MARKUP;
  const totalUsd = inputCostUsd + outputCostUsd;

  const rate = await getBsvUsdRate();
  const bsvAmount = totalUsd / rate;
  return Math.max(Math.ceil(bsvAmount * 1e8), 500);
}

export function getSupportedModels(): string[] {
  return Object.keys(UPSTREAM_PRICING);
}
