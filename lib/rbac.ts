import type { Role } from "@/lib/auth";

function isReadMethod(method: string): boolean {
  return method.toUpperCase() === "GET";
}

export function canAccessPage(role: Role, pathname: string): boolean {
  if (role === "admin") return true;
  if (pathname === "/") return true;
  if (pathname.startsWith("/settings/users")) return false;
  if (pathname.startsWith("/inventory")) return true;
  if (pathname.startsWith("/sales")) return true;
  if (pathname.startsWith("/procurement")) return true;
  if (pathname.startsWith("/reporting")) return true;

  if (pathname.startsWith("/finance")) {
    return role === "admin" || role === "manager";
  }

  if (pathname.startsWith("/hr")) {
    return role === "admin" || role === "manager";
  }

  if (pathname.startsWith("/settings")) {
    return role === "admin" || role === "manager";
  }

  if (pathname.startsWith("/operations")) {
    return role === "admin" || role === "manager";
  }

  return true;
}

export function canAccessApi(role: Role, pathname: string, method: string): boolean {
  if (role === "admin") return true;

  const readOnly = isReadMethod(method);

  if (pathname.startsWith("/api/settings/users")) {
    return false;
  }

  if (pathname.startsWith("/api/settings")) {
    if (role === "manager") {
      return method !== "DELETE";
    }
    return false;
  }

  if (pathname.startsWith("/api/operations")) {
    return role === "manager" ? method !== "DELETE" : false;
  }

  if (pathname.startsWith("/api/tools/excel")) {
    if (role === "manager") return method !== "DELETE";
    return false;
  }

  if (pathname.startsWith("/api/dashboard") || pathname.startsWith("/api/search")) {
    return readOnly;
  }

  if (pathname.startsWith("/api/finance")) {
    if (role === "manager") {
      if (pathname.startsWith("/api/finance/journal")) return method !== "DELETE";
      return readOnly;
    }
    return false;
  }

  if (pathname.startsWith("/api/hr")) {
    if (role === "manager") {
      if (pathname.startsWith("/api/hr/employees")) return method !== "DELETE";
      return readOnly;
    }
    return false;
  }

  if (pathname.startsWith("/api/inventory") || pathname.startsWith("/api/sales") || pathname.startsWith("/api/procurement")) {
    if (role === "manager") {
      return method !== "DELETE";
    }

    if (role === "staff") {
      if (pathname.startsWith("/api/procurement")) {
        return readOnly;
      }
      return method !== "DELETE";
    }
  }

  return readOnly;
}
