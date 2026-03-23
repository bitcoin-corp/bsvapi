import { NextRequest, NextResponse } from "next/server";
import {
  estimateCostSats,
  getServiceCostSats,
  getBsvUsdRate,
} from "@/lib/pricing";

/**
 * POST /api/v1/price — Get price estimate for a request (free, no payment needed)
 *
 * For chat models:   { model: "grok-3", messages: [...] }
 * For services:      { service: "whisper", units: 5 }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, messages, service, units } = body as {
      model?: string;
      messages?: Array<{ role: string; content: string }>;
      service?: string;
      units?: number;
    };

    const rate = await getBsvUsdRate();

    // Service-based pricing
    if (service) {
      const cost = await getServiceCostSats(service, units || 1);
      return NextResponse.json({
        service,
        units: units || 1,
        satoshis: cost.satoshis,
        bsv: cost.satoshis / 1e8,
        usd: cost.usdCost,
        bsvUsdRate: rate,
        description: cost.description,
      });
    }

    // Token-based pricing (chat models)
    if (!model || !messages?.length) {
      return NextResponse.json(
        {
          error:
            "Either { model, messages } for chat or { service, units } for services is required",
        },
        { status: 400 }
      );
    }

    const cost = await estimateCostSats(model, messages);

    return NextResponse.json({
      model,
      satoshis: cost.satoshis,
      bsv: cost.satoshis / 1e8,
      usd: cost.usdCost,
      bsvUsdRate: rate,
      breakdown: cost.breakdown,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pricing error" },
      { status: 400 }
    );
  }
}
