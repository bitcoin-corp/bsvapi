import { NextRequest, NextResponse } from "next/server";
import { UpstreamError } from "./providers/openaiCompat";

/**
 * The caller's IP for rate limiting. Behind Vercel the first x-forwarded-for entry is set by the platform. If you
 * self-host behind another proxy, make sure it overwrites (not appends to) x-forwarded-for, or this can be spoofed.
 */
export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Turn an unexpected error into a response that doesn't leak internals (DB errors, env var names, upstream bodies).
 * The full error is logged server-side. A provider's refusal of the caller's own request (4xx other than 408/429)
 * is passed through so the caller can see why.
 */
export function errorResponse(err: unknown, context: string): NextResponse {
  console.error(`${context}:`, err);
  if (err instanceof UpstreamError) {
    const s = err.status;
    if (s >= 400 && s < 500 && s !== 408 && s !== 429) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Upstream provider unavailable, try again" }, { status: 502 });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
