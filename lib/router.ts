/**
 * bAI router (ROUTER-PLAN.md): one request names a model id or a task alias (b/chat, b/fast, b/smart); the router tries
 * its candidates in order and falls back to the next on outages, rate limits and 5xx. A provider is
 * enabled only when its key is set, so OpenRouter and Anthropic stay off until keys (and credit) exist.
 *
 * Content refusals (4xx other than 408/429) are returned as they are, never retried on another provider: the router
 * must not become a way round each provider's safety rules.
 */
import type { ChatCompletionRequest, ChatCompletionResponse } from "./grok";
import { chat, chatStream, UpstreamError, type Upstream } from "./providers/openaiCompat";

const UPSTREAMS: Record<Upstream["id"], Upstream> = {
  xai: { id: "xai", baseUrl: process.env.XAI_BASE_URL || "https://api.x.ai/v1", key: process.env.XAI_API_KEY || "" },
  openrouter: {
    id: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    key: process.env.OPENROUTER_API_KEY || "",
    extraHeaders: { "HTTP-Referer": "https://bsvapi.com", "X-Title": "BSVAPI" },
  },
  anthropic: { id: "anthropic", baseUrl: "https://api.anthropic.com/v1", key: process.env.ANTHROPIC_API_KEY || "" },
};

/** USD per 1M tokens, upstream cost before our markup. Add a model here only with its price checked on the provider's page. */
export interface ModelEntry {
  id: string;
  provider: Upstream["id"];
  upstream: string;
  input: number;
  output: number;
}

export const MODELS: ModelEntry[] = [
  { id: "grok-3", provider: "xai", upstream: "grok-3", input: 3, output: 15 },
  { id: "grok-3-mini", provider: "xai", upstream: "grok-3-mini", input: 0.3, output: 0.5 },
  { id: "grok-2", provider: "xai", upstream: "grok-2", input: 2, output: 10 },
  // OpenRouter free models (no credit needed; rate-limited), checked against openrouter.ai/api/v1/models 1 Nov 2026.
  // Used as fallbacks after the paid model, so a busy free tier never blocks a call.
  { id: "gemma-4-31b", provider: "openrouter", upstream: "google/gemma-4-31b-it:free", input: 0, output: 0 },
  { id: "nemotron-3.5-lightning", provider: "openrouter", upstream: "nvidia/nemotron-3.5-lightning:free", input: 0, output: 0 },
  { id: "nemotron-3-ultra", provider: "openrouter", upstream: "nvidia/nemotron-3-ultra-550b-a55b:free", input: 0, output: 0 },
  // Anthropic entries go here once its key and credit exist and prices are checked.
];

/** Task aliases: candidate model ids in the order to try them. Disabled providers are skipped. */
export const ALIASES: Record<string, string[]> = {
  "b/chat": ["grok-3-mini", "gemma-4-31b", "nemotron-3.5-lightning"],
  "b/fast": ["grok-3-mini", "nemotron-3.5-lightning", "gemma-4-31b"],
  "b/smart": ["grok-3", "nemotron-3-ultra", "gemma-4-31b"],
};

const cost = (m: { input: number; output: number }) => m.input + m.output;
const enabled = (m: ModelEntry) => !!UPSTREAMS[m.provider].key;

/** Rolling failures per provider in this instance; a provider with 3+ recent failures is tried last. */
const failures = new Map<string, number[]>();
const WINDOW_MS = 5 * 60 * 1000;
const recentFailures = (p: string) => (failures.get(p) ?? []).filter((t) => Date.now() - t < WINDOW_MS).length;
const noteFailure = (p: string) => failures.set(p, [...(failures.get(p) ?? []), Date.now()].slice(-10));

/** The models a request may use, in the order to try them. Empty = unknown model or nothing enabled. */
export function candidates(model: string): ModelEntry[] {
  const ids = ALIASES[model] ?? [model];
  const list = ids.map((id) => MODELS.find((m) => m.id === id)).filter((m): m is ModelEntry => !!m && enabled(m));
  if (!ALIASES[model]) return list;
  // Keep the alias order; only push a provider with 3+ recent failures to the back (stable sort).
  return list.sort((a, b) => Number(recentFailures(a.provider) >= 3) - Number(recentFailures(b.provider) >= 3));
}

/**
 * Price used for a request: an alias is priced at its first healthy candidate, and route() only falls back
 * to candidates that cost no more, so the payer is never charged for a dearer model than the one that may answer.
 */
export function priceFor(model: string): { input: number; output: number } | null {
  const first = candidates(model)[0];
  return first ? { input: first.input, output: first.output } : null;
}

/** Retry on another provider only for outages: network, timeout, rate limit, 5xx. */
const retryable = (err: unknown) =>
  err instanceof UpstreamError && (err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500);

async function route<T>(model: string, call: (m: ModelEntry) => Promise<T>): Promise<{ result: T; used: ModelEntry }> {
  const all = candidates(model);
  if (!all.length) throw new UpstreamError(`Unsupported model: ${model}`, 400, "router");
  const list = all.filter((m) => cost(m) <= cost(all[0]));
  let last: unknown;
  for (const m of list) {
    try {
      return { result: await call(m), used: m };
    } catch (err) {
      last = err;
      if (!retryable(err)) throw err;
      noteFailure(m.provider);
    }
  }
  throw last;
}

/** Same shape as lib/grok's chatCompletion; `model` in the reply is the model that answered. */
export async function chatCompletion(r: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const { result, used } = await route(r.model, (m) => chat(UPSTREAMS[m.provider], r, m.upstream));
  return { ...result, model: used.id };
}

/** Same shape as lib/grok's chatCompletionStream. Fallback happens only before the first byte is sent. */
export async function chatCompletionStream(r: ChatCompletionRequest): Promise<{ stream: ReadableStream; response: Response }> {
  return (await route(r.model, (m) => chatStream(UPSTREAMS[m.provider], r, m.upstream))).result;
}

/** Public catalogue: enabled models plus aliases that resolve to at least one of them. */
export function listChatModels(): Array<{ id: string; provider: string; alias: boolean }> {
  return [
    ...MODELS.filter(enabled).map((m) => ({ id: m.id, provider: m.provider, alias: false })),
    ...Object.keys(ALIASES)
      .filter((a) => candidates(a).length)
      .map((a) => ({ id: a, provider: "bai", alias: true })),
  ];
}
