import { NextResponse } from "next/server";
import { getSupportedServices } from "@/lib/pricing";

/**
 * GET /api/v1/services — Discover all available services with pricing (free, no payment needed)
 */

const SERVICE_ENDPOINTS: Record<string, string> = {
  "image-sdxl": "/api/v1/images/generate",
  "image-flux": "/api/v1/images/generate",
  "video-wan": "/api/v1/video/generate",
  "video-kling": "/api/v1/video/generate",
  whisper: "/api/v1/transcriptions",
  "music-gen": "/api/v1/music/generate",
};

const SERVICE_TYPES: Record<string, string> = {
  "image-sdxl": "image",
  "image-flux": "image",
  "video-wan": "video",
  "video-kling": "video",
  whisper: "transcription",
  "music-gen": "audio",
};

const SERVICE_PROVIDERS: Record<string, string> = {
  "image-sdxl": "atlascloud",
  "image-flux": "atlascloud",
  "video-wan": "atlascloud",
  "video-kling": "atlascloud",
  whisper: "replicate",
  "music-gen": "replicate",
};

export async function GET() {
  const services = getSupportedServices();

  return NextResponse.json({
    services: services.map((s) => ({
      id: s.id,
      description: s.description,
      type: SERVICE_TYPES[s.id] || "unknown",
      provider: SERVICE_PROVIDERS[s.id] || "unknown",
      price_usd: s.usdPerUnit,
      endpoint: SERVICE_ENDPOINTS[s.id] || null,
    })),
  });
}
