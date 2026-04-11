const REPLICATE_URL = "https://api.replicate.com/v1";
const REPLICATE_KEY = process.env.REPLICATE_API_TOKEN || "";

export interface WhisperRequest {
  audio_url: string;
  language?: string;
}

export interface WhisperResponse {
  id: string;
  status: string;
  output?: {
    text: string;
    segments?: Array<{ start: number; end: number; text: string }>;
  };
}

export interface MusicGenRequest {
  prompt: string;
  duration?: number; // seconds
  model_version?: string;
}

export interface MusicGenResponse {
  id: string;
  status: string;
  output?: string; // audio URL
}

/**
 * Cache of model → latest version hash. Filled lazily on first use
 * of each model, keyed by `owner/name`. Versions rarely change for
 * a given model, and stale cache entries just mean a new prediction
 * runs against a slightly older version until the process restarts.
 */
const versionCache = new Map<string, string>();

async function getLatestVersion(model: string): Promise<string> {
  const cached = versionCache.get(model);
  if (cached) return cached;

  const res = await fetch(`${REPLICATE_URL}/models/${model}`, {
    headers: { Authorization: `Bearer ${REPLICATE_KEY}` },
  });
  if (!res.ok) {
    throw new Error(
      `Replicate model lookup (${model}) failed with ${res.status}: ${await res.text()}`
    );
  }
  const body = (await res.json()) as {
    latest_version?: { id?: string };
  };
  const id = body.latest_version?.id;
  if (!id) {
    throw new Error(
      `Replicate model ${model} has no latest_version.id in GET response`
    );
  }
  versionCache.set(model, id);
  return id;
}

async function createPrediction(
  model: string,
  input: Record<string, unknown>
): Promise<{ id: string; status: string; output?: unknown }> {
  if (!REPLICATE_KEY) throw new Error("REPLICATE_API_TOKEN not configured");

  // Two-step flow that works for both official and community
  // models on Replicate:
  //
  //   1. GET  /v1/models/{owner}/{name}        → returns latest_version.id
  //   2. POST /v1/predictions {version, input} → runs the model
  //
  // The legacy /v1/predictions endpoint requires an explicit
  // `version` field (it rejects `{model, input}` with 422 "version
  // is required"). The model-scoped `/v1/models/{owner}/{name}/predictions`
  // endpoint only exists for models marked as "official" by
  // Replicate; non-official models like meta/musicgen return 404
  // there. Looking up the version first handles both cases in one
  // code path.
  const version = await getLatestVersion(model);

  const res = await fetch(`${REPLICATE_URL}/predictions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${REPLICATE_KEY}`,
      Prefer: "wait",
    },
    body: JSON.stringify({ version, input }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Replicate error (${res.status}): ${err}`);
  }

  return res.json();
}

export async function transcribe(
  req: WhisperRequest
): Promise<WhisperResponse> {
  return createPrediction("openai/whisper", {
    audio: req.audio_url,
    language: req.language || "en",
  }) as Promise<WhisperResponse>;
}

export async function generateMusic(
  req: MusicGenRequest
): Promise<MusicGenResponse> {
  return createPrediction("meta/musicgen", {
    prompt: req.prompt,
    duration: req.duration || 10,
  }) as Promise<MusicGenResponse>;
}

export async function getPrediction(
  id: string
): Promise<{ status: string; output?: unknown }> {
  if (!REPLICATE_KEY) throw new Error("REPLICATE_API_TOKEN not configured");

  const res = await fetch(`${REPLICATE_URL}/predictions/${id}`, {
    headers: { Authorization: `Bearer ${REPLICATE_KEY}` },
  });

  if (!res.ok) throw new Error(`Prediction check failed (${res.status})`);
  return res.json();
}
