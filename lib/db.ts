/**
 * Database layer — uses Hetzner Supabase (Postgres) via SSH tunnel.
 *
 * For MVP, we use a local JSON file store so the project runs without
 * a database dependency. Migrate to Supabase when deploying to production.
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");
const USAGE_FILE = path.join(DATA_DIR, "usage.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(file: string, fallback: T): T {
  try {
    ensureDataDir();
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// --- Client Types ---

export interface Client {
  id: string;
  name: string;
  slug: string; // e.g. "npgx", "npg", "kintsugi"
  apiKey: string; // bsvapi_sk_xxx
  tier: "internal" | "mates" | "external";
  discountPercent: number; // 0-100, applied to base price
  active: boolean;
  createdAt: string;
  notes?: string;
}

export interface UsageLog {
  id: string;
  clientId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costSatoshis: number;
  costUsd: number;
  paymentTxid?: string;
  timestamp: string;
}

// --- Client CRUD ---

export function getClients(): Client[] {
  return readJson<Client[]>(CLIENTS_FILE, []);
}

export function getClient(id: string): Client | undefined {
  return getClients().find((c) => c.id === id);
}

export function getClientByApiKey(apiKey: string): Client | undefined {
  return getClients().find((c) => c.apiKey === apiKey && c.active);
}

export function getClientBySlug(slug: string): Client | undefined {
  return getClients().find((c) => c.slug === slug);
}

export function saveClient(client: Client): Client {
  const clients = getClients();
  const idx = clients.findIndex((c) => c.id === client.id);
  if (idx >= 0) {
    clients[idx] = client;
  } else {
    clients.push(client);
  }
  writeJson(CLIENTS_FILE, clients);
  return client;
}

export function deleteClient(id: string): boolean {
  const clients = getClients();
  const filtered = clients.filter((c) => c.id !== id);
  if (filtered.length === clients.length) return false;
  writeJson(CLIENTS_FILE, filtered);
  return true;
}

export function generateApiKey(slug: string): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `bsvapi_sk_${slug}_${rand}`;
}

// --- Usage Logging ---

export function logUsage(entry: Omit<UsageLog, "id">): UsageLog {
  const logs = getUsageLogs();
  const log: UsageLog = {
    ...entry,
    id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  logs.push(log);
  writeJson(USAGE_FILE, logs);
  return log;
}

export function getUsageLogs(clientId?: string): UsageLog[] {
  const logs = readJson<UsageLog[]>(USAGE_FILE, []);
  if (clientId) return logs.filter((l) => l.clientId === clientId);
  return logs;
}

// --- Aggregations ---

export interface ClientStats {
  client: Client;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostSatoshis: number;
  totalCostUsd: number;
  last24hCalls: number;
  last24hCostUsd: number;
  lastCallAt: string | null;
}

export function getClientStats(clientId?: string): ClientStats[] {
  const clients = clientId
    ? getClients().filter((c) => c.id === clientId)
    : getClients();
  const logs = getUsageLogs();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return clients.map((client) => {
    const clientLogs = logs.filter((l) => l.clientId === client.id);
    const recent = clientLogs.filter(
      (l) => now - new Date(l.timestamp).getTime() < day
    );

    return {
      client,
      totalCalls: clientLogs.length,
      totalInputTokens: clientLogs.reduce((s, l) => s + l.inputTokens, 0),
      totalOutputTokens: clientLogs.reduce((s, l) => s + l.outputTokens, 0),
      totalCostSatoshis: clientLogs.reduce((s, l) => s + l.costSatoshis, 0),
      totalCostUsd: clientLogs.reduce((s, l) => s + l.costUsd, 0),
      last24hCalls: recent.length,
      last24hCostUsd: recent.reduce((s, l) => s + l.costUsd, 0),
      lastCallAt: clientLogs.length
        ? clientLogs[clientLogs.length - 1].timestamp
        : null,
    };
  });
}

export interface PlatformStats {
  totalClients: number;
  activeClients: number;
  totalCalls: number;
  totalRevenueUsd: number;
  totalRevenueSatoshis: number;
  last24hCalls: number;
  last24hRevenueUsd: number;
}

export function getPlatformStats(): PlatformStats {
  const clients = getClients();
  const logs = getUsageLogs();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const recent = logs.filter(
    (l) => now - new Date(l.timestamp).getTime() < day
  );

  return {
    totalClients: clients.length,
    activeClients: clients.filter((c) => c.active).length,
    totalCalls: logs.length,
    totalRevenueUsd: logs.reduce((s, l) => s + l.costUsd, 0),
    totalRevenueSatoshis: logs.reduce((s, l) => s + l.costSatoshis, 0),
    last24hCalls: recent.length,
    last24hRevenueUsd: recent.reduce((s, l) => s + l.costUsd, 0),
  };
}
