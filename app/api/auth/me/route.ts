import { NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      username: user.username,
      name: user.name,
      role: user.role,
    },
  });
}
