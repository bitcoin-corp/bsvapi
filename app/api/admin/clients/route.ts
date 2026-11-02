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

  if (discountPercent !== undefined && (typeof discountPercent !== "number" || discountPercent < 0 || discountPercent > 100)) {
    return NextResponse.json({ error: "discountPercent must be 0-100" }, { status: 400 });
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

  const { id, name, tier, discount_percent, active } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Only these fields are editable; the key itself and its owner never change through this route.
  const updates: Record<string, unknown> = {};
  if (typeof name === "string") updates.name = name;
  if (typeof tier === "string") updates.tier = tier;
  if (typeof active === "boolean") updates.active = active;
  if (discount_percent !== undefined) {
    if (typeof discount_percent !== "number" || discount_percent < 0 || discount_percent > 100) {
      return NextResponse.json({ error: "discount_percent must be 0-100" }, { status: 400 });
    }
    updates.discount_percent = discount_percent;
  }

  const updated = await updateClient(id, updates);
  return NextResponse.json(updated);
}
