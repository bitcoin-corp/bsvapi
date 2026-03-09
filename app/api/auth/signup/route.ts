import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/db";
import { hashPassword, createSessionToken, sessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
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
      name: name?.trim() || null,
    });

    const token = await createSessionToken(user.id);
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
    res.headers.set("Set-Cookie", sessionCookie(token));
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signup failed";
    const isDuplicate =
      message.includes("duplicate") || message.includes("unique");
    return NextResponse.json(
      { error: isDuplicate ? "Email already registered" : message },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
