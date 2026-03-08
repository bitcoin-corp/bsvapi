"use client";

import { useState, useEffect, useCallback } from "react";

interface Client {
  id: string;
  name: string;
  slug: string;
  apiKey: string;
  tier: "internal" | "mates" | "external";
  discountPercent: number;
  active: boolean;
  createdAt: string;
  notes?: string;
}

interface ClientStats {
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

interface PlatformStats {
  totalClients: number;
  activeClients: number;
  totalCalls: number;
  totalRevenueUsd: number;
  totalRevenueSatoshis: number;
  last24hCalls: number;
  last24hRevenueUsd: number;
}

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [clients, setClients] = useState<ClientStats[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    slug: "",
    tier: "external" as Client["tier"],
    discountPercent: 0,
    notes: "",
  });

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats", {
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      setPlatform(data.platform);
      setClients(data.clients);
      setAuthenticated(true);
    } else {
      setAuthenticated(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (adminKey) fetchStats();
  }, [adminKey, fetchStats]);

  const createClient = async () => {
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify(newClient),
    });
    if (res.ok) {
      setNewClient({
        name: "",
        slug: "",
        tier: "external",
        discountPercent: 0,
        notes: "",
      });
      setShowNewClient(false);
      fetchStats();
    }
  };

  const toggleClient = async (client: Client) => {
    await fetch("/api/admin/clients", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify({ id: client.id, active: !client.active }),
    });
    fetchStats();
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-full max-w-sm p-8">
          <h1 className="text-2xl font-bold mb-6">BSVAPI Admin</h1>
          <input
            type="password"
            placeholder="Admin API Key"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 mb-4 text-white focus:border-yellow-500 focus:outline-none"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchStats()}
          />
          <button
            onClick={fetchStats}
            className="w-full bg-yellow-500 text-black font-semibold py-3 rounded-lg hover:bg-yellow-400"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  const tierColor = (tier: string) => {
    switch (tier) {
      case "internal":
        return "text-blue-400";
      case "mates":
        return "text-green-400";
      default:
        return "text-zinc-400";
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center font-mono font-bold text-black">
              ₿
            </div>
            <h1 className="text-xl font-bold">BSVAPI Admin</h1>
          </div>
          <a href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            Back to site
          </a>
        </div>

        {/* Platform Stats */}
        {platform && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total Clients"
              value={platform.totalClients.toString()}
              sub={`${platform.activeClients} active`}
            />
            <StatCard
              label="Total Calls"
              value={platform.totalCalls.toLocaleString()}
              sub={`${platform.last24hCalls} last 24h`}
            />
            <StatCard
              label="Revenue (USD)"
              value={`$${platform.totalRevenueUsd.toFixed(2)}`}
              sub={`$${platform.last24hRevenueUsd.toFixed(2)} last 24h`}
            />
            <StatCard
              label="Revenue (BSV)"
              value={`${(platform.totalRevenueSatoshis / 1e8).toFixed(6)} BSV`}
              sub={`${platform.totalRevenueSatoshis.toLocaleString()} sats`}
            />
          </div>
        )}

        {/* Clients */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Clients</h2>
          <button
            onClick={() => setShowNewClient(!showNewClient)}
            className="px-4 py-2 bg-yellow-500 text-black text-sm font-semibold rounded-lg hover:bg-yellow-400"
          >
            + New Client
          </button>
        </div>

        {/* New Client Form */}
        {showNewClient && (
          <div className="border border-zinc-800 rounded-xl p-6 mb-6">
            <h3 className="font-semibold mb-4">Register New Client</h3>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <input
                placeholder="Company Name (e.g. Ninja Punk Girls)"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                value={newClient.name}
                onChange={(e) =>
                  setNewClient({ ...newClient, name: e.target.value })
                }
              />
              <input
                placeholder="Slug (e.g. npgx)"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                value={newClient.slug}
                onChange={(e) =>
                  setNewClient({ ...newClient, slug: e.target.value })
                }
              />
              <select
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                value={newClient.tier}
                onChange={(e) => {
                  const tier = e.target.value as Client["tier"];
                  const discount =
                    tier === "internal" ? 50 : tier === "mates" ? 25 : 0;
                  setNewClient({
                    ...newClient,
                    tier,
                    discountPercent: discount,
                  });
                }}
              >
                <option value="internal">Internal (50% off)</option>
                <option value="mates">Mates Rates (25% off)</option>
                <option value="external">External (full price)</option>
              </select>
              <input
                type="number"
                placeholder="Discount %"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                value={newClient.discountPercent}
                onChange={(e) =>
                  setNewClient({
                    ...newClient,
                    discountPercent: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <input
              placeholder="Notes (optional)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white mb-4 focus:border-yellow-500 focus:outline-none"
              value={newClient.notes}
              onChange={(e) =>
                setNewClient({ ...newClient, notes: e.target.value })
              }
            />
            <div className="flex gap-3">
              <button
                onClick={createClient}
                className="px-4 py-2 bg-yellow-500 text-black text-sm font-semibold rounded-lg hover:bg-yellow-400"
              >
                Create Client
              </button>
              <button
                onClick={() => setShowNewClient(false)}
                className="px-4 py-2 border border-zinc-700 text-sm rounded-lg hover:border-zinc-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Client Table */}
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3 text-right">Calls</th>
                <th className="px-4 py-3 text-right">24h</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Sats</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((cs) => (
                <tr
                  key={cs.client.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{cs.client.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {cs.client.slug}
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${tierColor(cs.client.tier)}`}>
                    {cs.client.tier}
                  </td>
                  <td className="px-4 py-3">{cs.client.discountPercent}%</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {cs.totalCalls.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {cs.last24hCalls}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    ${cs.totalCostUsd.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {cs.totalCostSatoshis.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleClient(cs.client)}
                      className={`text-xs px-2 py-1 rounded ${
                        cs.client.active
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {cs.client.active ? "active" : "disabled"}
                    </button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No clients yet. Create one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* API Keys Section */}
        {clients.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">API Keys</h2>
            <div className="space-y-3">
              {clients.map((cs) => (
                <div
                  key={cs.client.id}
                  className="border border-zinc-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-sm">{cs.client.name}</div>
                    <code className="text-xs text-yellow-500">
                      {cs.client.apiKey}
                    </code>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {cs.client.tier} · {cs.client.discountPercent}% off
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="border border-zinc-800 rounded-xl p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{sub}</div>
    </div>
  );
}
