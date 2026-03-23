import { NextResponse } from "next/server";
import { getSupportedModels } from "@/lib/pricing";

/**
 * GET /api/v1/models — List available models and services (free, no payment needed)
 */
export async function GET() {
  const models = getSupportedModels();
  return NextResponse.json({
    object: "list",
    data: models.map((m) => ({
      id: m.id,
      object: "model",
      type: m.type,
      owned_by: m.provider,
    })),
  });
}
