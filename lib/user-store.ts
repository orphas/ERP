import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ManagedUserRecord = {
  id: number;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CreateUserInput = {
  username: string;
  password: string;
  name: string;
  role: Role;
  isActive?: boolean;
};

type UpdateUserInput = {
  username?: string;
  password?: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
};

const DEFAULT_USERS: Array<{ username: string; password: string; name: string; role: Role }> = [
  { username: "admin", password: "admin123", name: "System Admin", role: "admin" },
  { username: "manager", password: "manager123", name: "Operations Manager", role: "manager" },
  { username: "staff", password: "staff123", name: "ERP Staff", role: "staff" },
];

const ROLE_OPTIONS: Role[] = ["admin", "manager", "staff"];
const MIN_PASSWORD_LENGTH = 6;

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeName(value: string): string {
  return value.trim();
}

function assertRole(value: unknown): Role {
  if (typeof value !== "string" || !ROLE_OPTIONS.includes(value as Role)) {
    throw new Error("Invalid role");
  }

  return value as Role;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, 64);
  const storedKey = Buffer.from(storedHash, "hex");
  if (derivedKey.length !== storedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKey);
}

function sanitizeUser(user: {
  id: number;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ManagedUserRecord {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: assertRole(user.role),
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function countActiveAdmins(excludeId?: number): Promise<number> {
  return prisma.appUser.count({
    where: {
      role: "admin",
      isActive: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function ensureBootstrapUsers(): Promise<void> {
  const count = await prisma.appUser.count();
  if (count > 0) {
    return;
  }

  await prisma.appUser.createMany({
    data: DEFAULT_USERS.map((user) => ({
      username: user.username,
      passwordHash: hashPassword(user.password),
      name: user.name,
      role: user.role,
      isActive: true,
    })),
  });
}

export async function authenticateUser(username: string, password: string) {
  await ensureBootstrapUsers();

  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !password) {
    return null;
  }

  const user = await prisma.appUser.findUnique({
    where: { username: normalizedUsername },
  });

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return sanitizeUser(user);
}

export async function listManagedUsers(): Promise<ManagedUserRecord[]> {
  await ensureBootstrapUsers();
  const users = await prisma.appUser.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
  });
  return users.map(sanitizeUser);
}

export async function createManagedUser(input: CreateUserInput): Promise<ManagedUserRecord> {
  await ensureBootstrapUsers();

  const username = normalizeUsername(input.username);
  const name = normalizeName(input.name);
  const role = assertRole(input.role);
  const password = String(input.password || "");

  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }

  if (name.length < 2) {
    throw new Error("Name must be at least 2 characters");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const user = await prisma.appUser.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      name,
      role,
      isActive: input.isActive !== false,
    },
  });

  return sanitizeUser(user);
}

export async function updateManagedUser(id: number, input: UpdateUserInput, currentUsername?: string): Promise<ManagedUserRecord> {
  await ensureBootstrapUsers();

  const existing = await prisma.appUser.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("User not found");
  }

  const currentNormalized = currentUsername ? normalizeUsername(currentUsername) : null;
  const isSelf = currentNormalized === existing.username;

  const nextUsername = input.username === undefined ? existing.username : normalizeUsername(input.username);
  const nextName = input.name === undefined ? existing.name : normalizeName(input.name);
  const nextRole = input.role === undefined ? assertRole(existing.role) : assertRole(input.role);
  const nextIsActive = input.isActive === undefined ? existing.isActive : Boolean(input.isActive);

  if (nextUsername.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }

  if (nextName.length < 2) {
    throw new Error("Name must be at least 2 characters");
  }

  if (isSelf) {
    if (nextUsername !== existing.username) {
      throw new Error("You cannot change your own username while signed in");
    }
    if (nextRole !== existing.role) {
      throw new Error("You cannot change your own role while signed in");
    }
    if (nextIsActive !== existing.isActive) {
      throw new Error("You cannot deactivate your own active session");
    }
  }

  if (existing.role === "admin" && (!nextIsActive || nextRole !== "admin")) {
    const remainingAdmins = await countActiveAdmins(existing.id);
    if (remainingAdmins === 0) {
      throw new Error("At least one active admin account must remain");
    }
  }

  if (typeof input.password === "string" && input.password.length > 0 && input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const user = await prisma.appUser.update({
    where: { id },
    data: {
      username: nextUsername,
      name: nextName,
      role: nextRole,
      isActive: nextIsActive,
      ...(typeof input.password === "string" && input.password.length > 0
        ? { passwordHash: hashPassword(input.password) }
        : {}),
    },
  });

  return sanitizeUser(user);
}

export async function deleteManagedUser(id: number, currentUsername?: string): Promise<void> {
  await ensureBootstrapUsers();

  const existing = await prisma.appUser.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("User not found");
  }

  const currentNormalized = currentUsername ? normalizeUsername(currentUsername) : null;
  if (currentNormalized === existing.username) {
    throw new Error("You cannot delete your own account while signed in");
  }

  if (existing.role === "admin" && existing.isActive) {
    const remainingAdmins = await countActiveAdmins(existing.id);
    if (remainingAdmins === 0) {
      throw new Error("At least one active admin account must remain");
    }
  }

  await prisma.appUser.delete({ where: { id } });
}