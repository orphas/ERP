import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { deleteManagedUser, updateManagedUser } from "@/lib/user-store";
import { logOperation } from "@/lib/ops-log";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentUserFromCookies();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

function parseId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAdmin();
  if (!currentUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = await context.params;
  const id = parseId(params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const user = await updateManagedUser(
      id,
      {
        username: body.username,
        password: body.password,
        name: body.name,
        role: body.role,
        isActive: body.isActive,
      },
      currentUser.username
    );

    await logOperation({
      action: "USER_UPDATED",
      entityType: "AppUser",
      entityId: user.id,
      details: `User ${user.username} updated by ${currentUser.username}`,
    });

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    const status = /not found/i.test(message) ? 404 : /unique constraint/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAdmin();
  if (!currentUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = await context.params;
  const id = parseId(params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    await deleteManagedUser(id, currentUser.username);

    await logOperation({
      action: "USER_DELETED",
      entityType: "AppUser",
      entityId: id,
      details: `User ${id} deleted by ${currentUser.username}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}