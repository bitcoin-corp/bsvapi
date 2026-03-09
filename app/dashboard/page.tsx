"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface User {
  id: string;
  email: string;
  name: string | null;
  credits_sats: number;
  is_admin: boolean;
}

interface ApiKey {
  id: string;
  key: string;
  name: string;
  tier: string;
  discount_percent: number;
  active: boolean;
  created_at: string;
}

interface UsageEntry {
  id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_sats: number;
  cost_usd: number;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [meRes, usageRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/user/usage"),
    ]);

    if (!meRes.ok) {
      router.push("/login");
      return;
    }

    const meData = await meRes.json();
    setUser(meData.user);
    setApiKeys(meData.apiKeys || []);

    if (usageRes.ok) {
      setUsage(await usageRes.json());
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function createKey() {
    const res = await fetch("/api/user/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName || "default" }),
    });
    if (res.ok) {
      setNewKeyName("");
      fetchData();
    }
  }

  async function revokeKey(id: string) {
    await fetch("/api/user/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  const totalCalls = usage.length;
  const totalSpent = usage.reduce((s, u) => s + Number(u.cost_sats), 0);

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Image
              src="/images/bsvapi-logo.png"
              alt="BSVAPI"
              width={24}
              height={24}
            />
            <span className="font-semibold text-sm">BSVAPI</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-500">{user.email}</span>
            {user.is_admin && (
              <a href="/admin" className="text-zinc-500 hover:text-zinc-900">
                Admin
              </a>
            )}
            <button
              onClick={logout}
              className="text-zinc-500 hover:text-zinc-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="border border-zinc-200 p-4">
            <p className="text-xs text-zinc-400 mb-1">Credit Balance</p>
            <p className="text-2xl font-bold tabular-nums">
              {user.credits_sats.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-400">satoshis</p>
          </div>
          <div className="border border-zinc-200 p-4">
            <p className="text-xs text-zinc-400 mb-1">API Calls</p>
            <p className="text-2xl font-bold tabular-nums">{totalCalls}</p>
            <p className="text-xs text-zinc-400">total</p>
          </div>
          <div className="border border-zinc-200 p-4">
            <p className="text-xs text-zinc-400 mb-1">Total Spent</p>
            <p className="text-2xl font-bold tabular-nums">
              {totalSpent.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-400">satoshis</p>
          </div>
        </div>

        {/* API Keys */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-4">API Keys</h2>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Key name (e.g. production)"
              className="border border-zinc-300 px-3 py-2 text-sm flex-1 focus:border-zinc-900 focus:outline-none"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createKey()}
            />
            <button
              onClick={createKey}
              className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
            >
              Create Key
            </button>
          </div>

          {apiKeys.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No API keys yet. Create one to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((k) => (
                <div
                  key={k.id}
                  className="border border-zinc-200 p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <button
                      onClick={() => copyKey(k.key)}
                      className="text-xs font-mono text-zinc-500 hover:text-zinc-900"
                    >
                      {copiedKey === k.key ? "Copied!" : k.key}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 ${k.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                    >
                      {k.active ? "active" : "revoked"}
                    </span>
                    {k.active && (
                      <button
                        onClick={() => revokeKey(k.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Start */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
          <pre className="bg-zinc-50 border border-zinc-200 p-4 text-xs font-mono text-zinc-600 overflow-x-auto">
{`curl -X POST https://bsvapi.com/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKeys[0]?.key || "bsvapi_sk_your_key"}" \\
  -d '{"model":"grok-3-mini","messages":[{"role":"user","content":"Hello"}]}'`}
          </pre>
        </div>

        {/* Usage History */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Usage</h2>
          {usage.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No API calls yet. Use your key to get started.
            </p>
          ) : (
            <div className="border border-zinc-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-400 border-b border-zinc-200 text-xs">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Tokens
                    </th>
                    <th className="px-3 py-2 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-600">
                  {usage.slice(0, 50).map((u) => (
                    <tr key={u.id} className="border-b border-zinc-100">
                      <td className="px-3 py-2 text-xs font-mono">
                        {new Date(u.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono">{u.model}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {u.input_tokens + u.output_tokens}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(u.cost_sats).toLocaleString()} sats
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
