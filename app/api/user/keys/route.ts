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
    const { name } = await request.json();

    const slug = (name || "default").toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = generateApiKey(slug);

    const client = await saveClient({
      user_id: user.id,
      key,
      name: name || "default",
      tier: "external",
      discount_percent: 0,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
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
