import { NextRequest, NextResponse } from "next/server";
import { estimateCostSats, getBsvUsdRate } from "@/lib/pricing";

/**
 * POST /api/v1/price — Get price estimate for a request (free, no payment needed)
 */
export async function POST(request: NextRequest) {
  try {
    const { model, messages } = await request.json();

    if (!model || !messages?.length) {
      return NextResponse.json(
        { error: "model and messages are required" },
        { status: 400 }
      );
    }

    const cost = await estimateCostSats(model, messages);
    const rate = await getBsvUsdRate();

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
