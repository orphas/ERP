import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, validateCredentials } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const user = validateCredentials(String(username || ""), String(password || ""));

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSessionToken({
      username: user.username,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
