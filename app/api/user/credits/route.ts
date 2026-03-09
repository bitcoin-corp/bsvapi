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
 * POST /api/user/credits — Add credits (for now, admin-only or via BSV payment)
 * In future: HandCash payment flow or tokenised credits
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { amount_sats, txid } = await request.json();

    if (!amount_sats || amount_sats <= 0) {
      return NextResponse.json(
        { error: "amount_sats must be positive" },
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
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
