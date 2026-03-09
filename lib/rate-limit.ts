import { supabase } from "./supabase";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(
  key: string,
  windowMs: number = 60_000,
  maxRequests: number = 30
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / windowMs) * windowMs
  );
  const resetAt = new Date(windowStart.getTime() + windowMs);

  const { data: count } = await supabase.rpc("bsvapi_increment_rate_limit", {
    p_key: key,
    p_window: windowStart.toISOString(),
  });

  const current = count ?? 1;
  return {
    allowed: current <= maxRequests,
    remaining: Math.max(0, maxRequests - current),
    resetAt,
  };
}
