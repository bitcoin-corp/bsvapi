import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserApiKeys, saveClient, generateApiKey, updateClient } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const keys = await getUserApiKeys(user.id);
    return NextResponse.json(keys);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 64) : "default";

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32) || "key";
    const key = generateApiKey(slug);

    const client = await saveClient({
      user_id: user.id,
      key,
      name,
      tier: "external",
      discount_percent: 0,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("app/api/user/keys/route.ts error:", err);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { id } = await request.json();

    // Verify key belongs to user
    const keys = await getUserApiKeys(user.id);
    if (!keys.find((k) => k.id === id)) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    await updateClient(id, { active: false });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
