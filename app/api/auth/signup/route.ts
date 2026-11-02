import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/db";
import { hashPassword, createSessionToken, sessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(`signup:${clientIp(request)}`, 60 * 60_000, 10);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many sign-ups from this address, try again later" }, { status: 429 });
    }

    const { email, password, name } = await request.json();

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length > 200) {
      return NextResponse.json({ error: "Password is too long" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const password_hash = await hashPassword(password);
    const user = await createUser({
      email: email.toLowerCase().trim(),
      password_hash,
      name: typeof name === "string" ? name.trim().slice(0, 100) || undefined : undefined,
    });

    const token = await createSessionToken(user.id);
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    res.headers.set("Set-Cookie", sessionCookie(token));
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? "");
    const isDuplicate =
      (err as { code?: string })?.code === "23505" ||
      message.includes("duplicate") ||
      message.includes("unique");
    if (!isDuplicate) console.error("Signup error:", err);
    return NextResponse.json(
      { error: isDuplicate ? "Email already registered" : "Signup failed" },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
