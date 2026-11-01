import { supabase } from "./supabase";
import crypto from "crypto";

// --- Types ---

export interface Client {
  id: string;
  user_id: string;
  key: string;
  name: string;
  tier: string;
  discount_percent: number;
  active: boolean;
  created_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string | null;
  api_key_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_sats: number;
  cost_usd: number;
  payment_txid?: string;
  created_at: string;
}

// --- API Key Operations ---

export async function getClientByApiKey(
  apiKey: string
): Promise<Client | null> {
  const { data } = await supabase
    .from("bsvapi_api_keys")
    .select("*")
    .eq("key", apiKey)
    .eq("active", true)
    .single();
  return data;
}

export async function getClients(): Promise<Client[]> {
  const { data } = await supabase
    .from("bsvapi_api_keys")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
}

export async function saveClient(client: {
  user_id: string;
  key: string;
  name: string;
  tier: string;
  discount_percent: number;
  active?: boolean;
}): Promise<Client> {
  const { data, error } = await supabase
    .from("bsvapi_api_keys")
    .insert({ ...client, active: client.active ?? true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(
  id: string,
  updates: Partial<Client>
): Promise<Client> {
  const { data, error } = await supabase
    .from("bsvapi_api_keys")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function generateApiKey(slug: string): string {
  const rand = crypto.randomBytes(16).toString("hex");
  return `bsvapi_sk_${slug}_${rand}`;
}

// --- User Operations ---

export async function createUser(user: {
  email: string;
  password_hash: string;
  name?: string;
}) {
  const { data, error } = await supabase
    .from("bsvapi_users")
    .insert(user)
    .select("id, email, name, credits_sats, is_admin")
    .single();
  if (error) throw error;
  return data;
}

export async function getUserByEmail(email: string) {
  const { data } = await supabase
    .from("bsvapi_users")
    .select("id, email, name, password_hash, credits_sats, is_admin")
    .eq("email", email.toLowerCase())
    .single();
  return data;
}

export async function getUserById(id: string) {
  const { data } = await supabase
    .from("bsvapi_users")
    .select("id, email, name, credits_sats, is_admin")
    .eq("id", id)
    .single();
  return data;
}

export async function getUserApiKeys(userId: string) {
  const { data } = await supabase
    .from("bsvapi_api_keys")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

// --- Credit Operations ---

export async function addCredits(
  userId: string,
  amountSats: number,
  reason: string,
  txid?: string
) {
  // Get current balance
  const { data: user } = await supabase
    .from("bsvapi_users")
    .select("credits_sats")
    .eq("id", userId)
    .single();

  if (!user) throw new Error("User not found");

  const newBalance = user.credits_sats + amountSats;

  // Update balance
  await supabase
    .from("bsvapi_users")
    .update({ credits_sats: newBalance, updated_at: new Date().toISOString() })
    .eq("id", userId);

  // Record transaction
  await supabase.from("bsvapi_credit_txns").insert({
    user_id: userId,
    amount_sats: amountSats,
    txid,
    reason,
    balance_after: newBalance,
  });

  return newBalance;
}

/**
 * Run an upstream call for credits already deducted; if it throws, give the credits back so a failed call costs nothing.
 */
export async function refundOnFail<T>(
  userId: string | null | undefined,
  amountSats: number,
  reason: string,
  call: () => Promise<T>
): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (userId && amountSats > 0) await addCredits(userId, amountSats, `refund:${reason}`).catch(() => {});
    throw err;
  }
}

export async function deductCredits(
  userId: string,
  amountSats: number,
  reason: string
): Promise<{ success: boolean; balance: number }> {
  const { data: user } = await supabase
    .from("bsvapi_users")
    .select("credits_sats")
    .eq("id", userId)
    .single();

  if (!user) return { success: false, balance: 0 };
  if (user.credits_sats < amountSats)
    return { success: false, balance: user.credits_sats };

  const newBalance = user.credits_sats - amountSats;

  await supabase
    .from("bsvapi_users")
    .update({ credits_sats: newBalance, updated_at: new Date().toISOString() })
    .eq("id", userId);

  await supabase.from("bsvapi_credit_txns").insert({
    user_id: userId,
    amount_sats: -amountSats,
    reason,
    balance_after: newBalance,
  });

  return { success: true, balance: newBalance };
}

// --- Usage Logging ---

export async function logUsage(entry: {
  user_id?: string;
  api_key_id?: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_sats: number;
  cost_usd: number;
  payment_txid?: string;
}): Promise<void> {
  await supabase.from("bsvapi_usage").insert(entry);
}

export async function getUsageLogs(
  userId?: string,
  limit: number = 100
): Promise<UsageLog[]> {
  let q = supabase
    .from("bsvapi_usage")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) q = q.eq("user_id", userId);

  const { data } = await q;
  return data || [];
}

// --- Replay Protection ---

export async function isTxidUsed(txid: string): Promise<boolean> {
  const { data } = await supabase
    .from("bsvapi_used_txids")
    .select("txid")
    .eq("txid", txid)
    .single();
  return !!data;
}

export async function recordTxid(txid: string): Promise<void> {
  await supabase.from("bsvapi_used_txids").insert({ txid });
}

// --- Stats (Admin) ---

export interface PlatformStats {
  totalUsers: number;
  totalKeys: number;
  activeKeys: number;
  totalCalls: number;
  totalRevenueUsd: number;
  totalRevenueSatoshis: number;
  last24hCalls: number;
  last24hRevenueUsd: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [users, keys, usage, recentUsage] = await Promise.all([
    supabase.from("bsvapi_users").select("id", { count: "exact", head: true }),
    supabase.from("bsvapi_api_keys").select("id, active", { count: "exact" }),
    supabase.from("bsvapi_usage").select("cost_sats, cost_usd"),
    supabase.from("bsvapi_usage").select("cost_sats, cost_usd").gte("created_at", day),
  ]);

  const allUsage = usage.data || [];
  const recent = recentUsage.data || [];
  const activeCount = (keys.data || []).filter((k) => k.active).length;

  return {
    totalUsers: users.count || 0,
    totalKeys: keys.count || 0,
    activeKeys: activeCount,
    totalCalls: allUsage.length,
    totalRevenueUsd: allUsage.reduce((s, l) => s + Number(l.cost_usd), 0),
    totalRevenueSatoshis: allUsage.reduce((s, l) => s + Number(l.cost_sats), 0),
    last24hCalls: recent.length,
    last24hRevenueUsd: recent.reduce((s, l) => s + Number(l.cost_usd), 0),
  };
}

export async function getClientStats() {
  const { data: keys } = await supabase
    .from("bsvapi_api_keys")
    .select("*")
    .order("created_at", { ascending: false });

  if (!keys?.length) return [];

  const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  return Promise.all(
    keys.map(async (key) => {
      const [allUsage, recentUsage] = await Promise.all([
        supabase.from("bsvapi_usage").select("*").eq("api_key_id", key.id),
        supabase
          .from("bsvapi_usage")
          .select("*")
          .eq("api_key_id", key.id)
          .gte("created_at", day),
      ]);

      const logs = allUsage.data || [];
      const recent = recentUsage.data || [];

      return {
        client: {
          id: key.id,
          name: key.name,
          slug: key.name,
          apiKey: key.key,
          tier: key.tier,
          discountPercent: key.discount_percent,
          active: key.active,
          createdAt: key.created_at,
        },
        totalCalls: logs.length,
        totalInputTokens: logs.reduce((s, l) => s + l.input_tokens, 0),
        totalOutputTokens: logs.reduce((s, l) => s + l.output_tokens, 0),
        totalCostSatoshis: logs.reduce((s, l) => s + Number(l.cost_sats), 0),
        totalCostUsd: logs.reduce((s, l) => s + Number(l.cost_usd), 0),
        last24hCalls: recent.length,
        last24hCostUsd: recent.reduce((s, l) => s + Number(l.cost_usd), 0),
        lastCallAt: logs.length ? logs[0].created_at : null,
      };
    })
  );
}
