import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { supabase } from "./supabase";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "bsvapi-dev-secret-change-me"
);
const COOKIE_NAME = "bsvapi_session";

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
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export function sessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`;
}

export async function getSession(
  request: NextRequest
): Promise<SessionUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
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
  // Allow ADMIN_API_KEY header for backward compat
  const auth = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && auth === `Bearer ${adminKey}`) {
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
