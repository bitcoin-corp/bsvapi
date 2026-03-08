import { NextRequest, NextResponse } from "next/server";
import { getClients, saveClient, generateApiKey, type Client } from "@/lib/db";
import crypto from "crypto";

function checkAdmin(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return false;
  return auth === `Bearer ${adminKey}`;
}

/** GET /api/admin/clients — list all clients */
export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getClients());
}

/** POST /api/admin/clients — create a new client */
export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, slug, tier, discountPercent, notes } = body as {
    name?: string;
    slug?: string;
    tier?: Client["tier"];
    discountPercent?: number;
    notes?: string;
  };

  if (!name || !slug) {
    return NextResponse.json(
      { error: "name and slug are required" },
      { status: 400 }
    );
  }

  const client: Client = {
    id: crypto.randomUUID(),
    name,
    slug,
    apiKey: generateApiKey(slug),
    tier: tier || "external",
    discountPercent: discountPercent ?? (tier === "internal" ? 50 : tier === "mates" ? 25 : 0),
    active: true,
    createdAt: new Date().toISOString(),
    notes,
  };

  saveClient(client);
  return NextResponse.json(client, { status: 201 });
}

/** PUT /api/admin/clients — update a client */
export async function PUT(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const clients = getClients();
  const existing = clients.find((c) => c.id === id);
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const updated = { ...existing, ...updates, id: existing.id };
  saveClient(updated);
  return NextResponse.json(updated);
}
