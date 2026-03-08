import { NextResponse } from "next/server";
import { getSupportedModels } from "@/lib/pricing";

/**
 * GET /api/v1/models — List available models (free, no payment needed)
 */
export async function GET() {
  const models = getSupportedModels();
  return NextResponse.json({
    object: "list",
    data: models.map((id) => ({
      id,
      object: "model",
      owned_by: "xai",
    })),
  });
}
