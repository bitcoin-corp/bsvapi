/**
 * Atlas Cloud provider client.
 *
 * Endpoints used:
 *
 *   POST /api/v1/model/generateImage   (sync when enable_sync_mode:true)
 *   POST /api/v1/model/generateVideo   (async, returns an id to poll)
 *   GET  /api/v1/model/result/{id}     (polling endpoint)
 *
 * The earlier stub used /v1/images/generate which returns 404.
 */

const ATLASCLOUD_URL =
  (process.env.ATLASCLOUD_URL || "https://api.atlascloud.ai").replace(/\/+$/, "");
const ATLASCLOUD_KEY = (process.env.ATLASCLOUD_API_KEY || "").trim();

/** Default image model — cheapest Atlas option at $0.01/image */
const DEFAULT_IMAGE_MODEL = "z-image/turbo";
/** Default video model when the caller passes none */
const DEFAULT_VIDEO_MODEL = "alibaba/wan-2.2-spicy/image-to-video-lora";

export interface ImageRequest {
  prompt: string;
  /** Atlas model id, e.g. "z-image/turbo", "bytedance/seedream-v5.0-lite" */
  model?: string;
  width?: number;
  height?: number;
}

export interface ImageResponse {
  id: string;
  status: string;
  /** Primary output URL — first entry of `outputs` for client convenience */
  output: string;
  /** All output URLs the model produced */
  outputs: string[];
  model: string;
  created: number;
}

export interface VideoRequest {
  prompt: string;
  model?: string;
  /** Required for image-to-video models — the starting frame */
  image_url?: string;
  /** 5 or 8 seconds (Atlas clamp) */
  duration?: number;
  resolution?: "480p" | "720p";
  width?: number;
  height?: number;
}

export interface VideoStartResponse {
  id: string;
  status: "queued";
  created: number;
  model: string;
  note: string;
}

function requireKey(): string {
  if (!ATLASCLOUD_KEY) {
    throw new Error("ATLASCLOUD_API_KEY not configured");
  }
  return ATLASCLOUD_KEY;
}

/**
 * Generate an image (sync mode — blocks until the model finishes).
 * Typical latency is 2-10 seconds for z-image/turbo.
 */
export async function generateImage(
  req: ImageRequest,
): Promise<ImageResponse> {
  const apiKey = requireKey();
  const model = req.model || DEFAULT_IMAGE_MODEL;

  // z-image/turbo and similar accept arbitrary WxH within [512, 2048]
  const w = Math.min(2048, Math.max(512, req.width ?? 1024));
  const h = Math.min(2048, Math.max(512, req.height ?? 1024));
  const size = `${w}*${h}`;

  const res = await fetch(`${ATLASCLOUD_URL}/api/v1/model/generateImage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: req.prompt,
      size,
      enable_sync_mode: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `AtlasCloud image error (${res.status}): ${errText.slice(0, 400)}`,
    );
  }

  const body = await res.json();
  const data = body?.data ?? body;
  const outputs: string[] = Array.isArray(data.outputs)
    ? data.outputs
    : data.output
      ? [data.output]
      : [];

  if (!outputs.length || data.status !== "completed") {
    throw new Error(
      `AtlasCloud image generation did not complete: status=${data.status}, outputs=${outputs.length}`,
    );
  }

  return {
    id: String(data.id ?? ""),
    status: data.status,
    output: outputs[0],
    outputs,
    model,
    created: Date.now(),
  };
}

/**
 * Start a video generation job. Atlas's video models are async —
 * the response carries an id and you must poll /result/{id} to
 * learn when the video is ready.
 */
export async function startVideo(
  req: VideoRequest,
): Promise<VideoStartResponse> {
  const apiKey = requireKey();
  const model = req.model || DEFAULT_VIDEO_MODEL;

  const duration = (req.duration ?? 5) <= 6 ? 5 : 8;
  const body: Record<string, unknown> = {
    model,
    prompt: req.prompt,
    duration,
    resolution: req.resolution ?? "720p",
    seed: -1,
    high_noise_loras: [],
    low_noise_loras: [],
  };
  if (req.image_url) body.image = req.image_url;
  if (req.width && req.height) {
    body.width = req.width;
    body.height = req.height;
  }

  const res = await fetch(`${ATLASCLOUD_URL}/api/v1/model/generateVideo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `AtlasCloud video error (${res.status}): ${errText.slice(0, 400)}`,
    );
  }

  const payload = await res.json();
  const id = payload?.data?.id ?? payload?.id;
  if (!id) {
    throw new Error("AtlasCloud video generation returned no id");
  }

  return {
    id: String(id),
    status: "queued",
    created: Date.now(),
    model,
    note: "Video generation is async. Poll /api/v1/video/result/{id} to get the URL when ready.",
  };
}

export interface VideoPollResponse {
  status: "generating" | "done" | "error";
  output?: string;
  videoUrl?: string;
  error?: string;
}

export async function pollVideo(requestId: string): Promise<VideoPollResponse> {
  const apiKey = requireKey();
  const res = await fetch(
    `${ATLASCLOUD_URL}/api/v1/model/result/${requestId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `AtlasCloud poll error (${res.status}): ${errText.slice(0, 400)}`,
    );
  }
  const body = await res.json();
  const data = body?.data ?? body;
  if (data.status === "completed") {
    const url =
      data.outputs?.[0] ??
      data.output ??
      data.video_url ??
      data.videoUrl;
    if (!url) return { status: "error", error: "completed but no url" };
    return { status: "done", output: url, videoUrl: url };
  }
  if (data.status === "error" || data.error) {
    return { status: "error", error: data.error ?? "unknown atlas error" };
  }
  return { status: "generating" };
}

/**
 * Back-compat alias — the old video route imported `generateVideo`
 * expecting a sync call. The new pipeline is async, so this just
 * starts the job and returns an id. Callers must poll.
 */
export const generateVideo = startVideo;

/**
 * Legacy poll helper alias used by older routes that call
 * `checkStatus(jobId)` and expect `{ status, output }`.
 */
export async function checkStatus(
  jobId: string,
): Promise<{ status: string; output?: string }> {
  const r = await pollVideo(jobId);
  return { status: r.status, output: r.output };
}
