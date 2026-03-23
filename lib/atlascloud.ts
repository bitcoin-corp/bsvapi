const ATLASCLOUD_URL =
  process.env.ATLASCLOUD_URL || "https://api.atlascloud.ai";
const ATLASCLOUD_KEY = process.env.ATLASCLOUD_API_KEY || "";

export interface ImageRequest {
  prompt: string;
  model?: string; // "sdxl" | "flux-schnell"
  width?: number;
  height?: number;
  num_outputs?: number;
}

export interface ImageResponse {
  id: string;
  status: string;
  output: string[]; // URLs
  created: number;
}

export interface VideoRequest {
  prompt: string;
  model?: string; // "wan-2.1" | "kling"
  image_url?: string; // for image-to-video
  duration?: number;
}

export interface VideoResponse {
  id: string;
  status: string;
  output?: string; // URL when complete
  created: number;
}

export async function generateImage(
  req: ImageRequest
): Promise<ImageResponse> {
  if (!ATLASCLOUD_KEY) throw new Error("ATLASCLOUD_API_KEY not configured");

  const model = req.model || "sdxl";
  const res = await fetch(`${ATLASCLOUD_URL}/v1/images/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ATLASCLOUD_KEY}`,
    },
    body: JSON.stringify({
      model,
      prompt: req.prompt,
      width: req.width || 1024,
      height: req.height || 1024,
      num_outputs: req.num_outputs || 1,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AtlasCloud image error (${res.status}): ${err}`);
  }

  return res.json();
}

export async function generateVideo(
  req: VideoRequest
): Promise<VideoResponse> {
  if (!ATLASCLOUD_KEY) throw new Error("ATLASCLOUD_API_KEY not configured");

  const model = req.model || "wan-2.1";
  const res = await fetch(`${ATLASCLOUD_URL}/v1/video/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ATLASCLOUD_KEY}`,
    },
    body: JSON.stringify({
      model,
      prompt: req.prompt,
      image_url: req.image_url,
      duration: req.duration || 5,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AtlasCloud video error (${res.status}): ${err}`);
  }

  return res.json();
}

export async function checkStatus(
  jobId: string
): Promise<{ status: string; output?: string }> {
  if (!ATLASCLOUD_KEY) throw new Error("ATLASCLOUD_API_KEY not configured");

  const res = await fetch(`${ATLASCLOUD_URL}/v1/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${ATLASCLOUD_KEY}` },
  });

  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  return res.json();
}
