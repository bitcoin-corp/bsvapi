import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { verifyPassword, createSessionToken, sessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    // Slow down password guessing: 10 attempts per IP per 5 minutes.
    const rate = await checkRateLimit(`login:${clientIp(request)}`, 5 * 60_000, 10);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many attempts, try again later" }, { status: 429 });
    }

    const { email, password } = await request.json();

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(user.id);
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits_sats: user.credits_sats,
      },
    });
    res.headers.set("Set-Cookie", sessionCookie(token));
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
