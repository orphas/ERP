import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { createManagedUser, listManagedUsers } from "@/lib/user-store";
import { logOperation } from "@/lib/ops-log";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentUserFromCookies();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export async function GET() {
  const currentUser = await requireAdmin();
  if (!currentUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await listManagedUsers();
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const currentUser = await requireAdmin();
  if (!currentUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const user = await createManagedUser({
      username: String(body.username || ""),
      password: String(body.password || ""),
      name: String(body.name || ""),
      role: body.role,
      isActive: body.isActive !== false,
    });

    await logOperation({
      action: "USER_CREATED",
      entityType: "AppUser",
      entityId: user.id,
      details: `User ${user.username} created by ${currentUser.username}`,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    const status = /unique constraint/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}