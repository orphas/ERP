import { cookies } from "next/headers";

export type Role = "admin" | "manager" | "staff";

export interface SessionUser {
  username: string;
  name: string;
  role: Role;
  exp: number;
}

const DEFAULT_SECRET = "erp_sgicr_dev_secret_change_me";
export const SESSION_COOKIE = "erp_session";

const USERS = [
  { username: "admin", password: "admin123", name: "System Admin", role: "admin" as const },
  { username: "manager", password: "manager123", name: "Operations Manager", role: "manager" as const },
  { username: "staff", password: "staff123", name: "ERP Staff", role: "staff" as const },
];

function getSecret(): string {
  return process.env.AUTH_SECRET || DEFAULT_SECRET;
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToUint8(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function validateCredentials(username: string, password: string) {
  return USERS.find((u) => u.username === username && u.password === password) || null;
}

export async function createSessionToken(user: { username: string; name: string; role: Role }): Promise<string> {
  const payload = {
    username: user.username,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  };

  const payloadPart = uint8ToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadPart));
  const signaturePart = uint8ToBase64Url(new Uint8Array(signature));
  return `${payloadPart}.${signaturePart}`;
}

export async function verifySessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    return null;
  }

  const key = await getHmacKey();
  const signatureBytes = base64UrlToUint8(signaturePart);
  const signatureForVerify = Uint8Array.from(signatureBytes);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureForVerify,
    new TextEncoder().encode(payloadPart)
  );

  if (!valid) {
    return null;
  }

  try {
    const payloadText = new TextDecoder().decode(base64UrlToUint8(payloadPart));
    const payload = JSON.parse(payloadText) as SessionUser;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (!["admin", "manager", "staff"].includes(payload.role)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUserFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}
