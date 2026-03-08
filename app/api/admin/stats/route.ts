import { NextRequest, NextResponse } from "next/server";
import { getPlatformStats, getClientStats } from "@/lib/db";

function checkAdmin(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return false;
  return auth === `Bearer ${adminKey}`;
}

export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = getPlatformStats();
  const clients = getClientStats();

  return NextResponse.json({ platform, clients });
}
