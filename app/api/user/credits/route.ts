import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { addCredits } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return NextResponse.json({ credits_sats: user.credits_sats });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * POST /api/user/credits — Add credits. Admin only until deposit txids are verified on chain.
 * In future: HandCash payment flow or tokenised credits
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    // Deposits are not verified on chain yet, so self-service crediting would mint free credit. Admin only until then.
    if (!user.is_admin) {
      return NextResponse.json({ error: "Deposits are not open yet" }, { status: 403 });
    }
    const { amount_sats, txid } = await request.json();

    if (!Number.isSafeInteger(amount_sats) || amount_sats <= 0) {
      return NextResponse.json(
        { error: "amount_sats must be a positive whole number" },
        { status: 400 }
      );
    }

    // TODO: Verify BSV payment txid before crediting
    // For now, require txid to be provided (manual verification)
    if (!txid) {
      return NextResponse.json(
        { error: "BSV payment txid required" },
        { status: 400 }
      );
    }

    const newBalance = await addCredits(
      user.id,
      amount_sats,
      "deposit",
      txid
    );

    return NextResponse.json({ credits_sats: newBalance });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("app/api/user/credits/route.ts error:", err);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
