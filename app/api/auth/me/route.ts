import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserApiKeys } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const keys = await getUserApiKeys(user.id);

  return NextResponse.json({
    user,
    apiKeys: keys.map((k) => ({
      id: k.id,
      key: k.key,
      name: k.name,
      tier: k.tier,
      discount_percent: k.discount_percent,
      active: k.active,
      created_at: k.created_at,
    })),
  });
}
