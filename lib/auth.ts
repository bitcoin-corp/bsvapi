import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { supabase } from "./supabase";

const COOKIE_NAME = "bsvapi_session";
const JWT_ALG = "HS256";

/**
 * The session-signing secret. There is deliberately no fallback: a default secret in public source would let anyone
 * mint a session for any user id, admins included. Read lazily so `next build` works without it.
 */
function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters (e.g. `openssl rand -hex 32`)");
  }
  return new TextEncoder().encode(secret);
}

/** Constant-time string compare (hashing first so unequal lengths don't short-circuit). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  credits_sats: number;
  is_admin: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(jwtSecret());
}

export function sessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export async function getSession(
  request: NextRequest
): Promise<SessionUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  // Outside the try: a missing JWT_SECRET is a server misconfiguration and should fail loudly, not look like "logged out".
  const secret = jwtSecret();
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [JWT_ALG] });
    const userId = payload.sub;
    if (!userId) return null;

    const { data } = await supabase
      .from("bsvapi_users")
      .select("id, email, name, credits_sats, is_admin")
      .eq("id", userId)
      .single();

    return data;
  } catch {
    return null;
  }
}

export async function requireAuth(
  request: NextRequest
): Promise<SessionUser> {
  const user = await getSession(request);
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin(
  request: NextRequest
): Promise<SessionUser> {
  // Allow ADMIN_API_KEY header for backward compat. Ignored unless it is long enough to resist guessing.
  const auth = request.headers.get("authorization") ?? "";
  const adminKey = process.env.ADMIN_API_KEY ?? "";
  if (adminKey.length >= 32 && safeEqual(auth, `Bearer ${adminKey}`)) {
    return {
      id: "admin",
      email: "admin",
      name: "Admin",
      credits_sats: 0,
      is_admin: true,
    };
  }

  const user = await requireAuth(request);
  if (!user.is_admin) throw new Error("Forbidden");
  return user;
}
