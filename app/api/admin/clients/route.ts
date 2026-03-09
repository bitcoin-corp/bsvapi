import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClients, saveClient, updateClient, generateApiKey } from "@/lib/db";

async function checkAdmin(request: NextRequest) {
  try {
    await requireAdmin(request);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!(await checkAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clients = await getClients();
  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  if (!(await checkAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, slug, tier, discountPercent, user_id } = await request.json();

  if (!name || !slug) {
    return NextResponse.json(
      { error: "name and slug are required" },
      { status: 400 }
    );
  }

  const key = generateApiKey(slug);
  const client = await saveClient({
    user_id: user_id || "00000000-0000-0000-0000-000000000000",
    key,
    name,
    tier: tier || "external",
    discount_percent:
      discountPercent ?? (tier === "internal" ? 50 : tier === "mates" ? 25 : 0),
  });

  return NextResponse.json(client, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await checkAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, ...updates } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updated = await updateClient(id, updates);
  return NextResponse.json(updated);
}
