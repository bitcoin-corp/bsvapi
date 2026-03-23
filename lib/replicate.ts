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

async function createPrediction(
  model: string,
  input: Record<string, unknown>
): Promise<{ id: string; status: string }> {
  if (!REPLICATE_KEY) throw new Error("REPLICATE_API_TOKEN not configured");

  const res = await fetch(`${REPLICATE_URL}/predictions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${REPLICATE_KEY}`,
      Prefer: "wait",
    },
    body: JSON.stringify({ model, input }),
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
