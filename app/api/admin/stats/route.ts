import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPlatformStats, getClientStats } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [platform, clients] = await Promise.all([
    getPlatformStats(),
    getClientStats(),
  ]);

  return NextResponse.json({ platform, clients });
}
