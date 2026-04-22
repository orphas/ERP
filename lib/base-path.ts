function normalizeBasePath(input?: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, "");
}

export const APP_BASE_PATH = normalizeBasePath(process.env.APP_BASE_PATH);

export function withBasePath(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (!APP_BASE_PATH) {
    return normalizedPath;
  }

  if (normalizedPath === APP_BASE_PATH || normalizedPath.startsWith(`${APP_BASE_PATH}/`)) {
    return normalizedPath;
  }

  if (normalizedPath === "/") {
    return APP_BASE_PATH;
  }

  return `${APP_BASE_PATH}${normalizedPath}`;
}

export function stripBasePath(pathname: string): string {
  if (!APP_BASE_PATH) {
    return pathname;
  }

  if (pathname === APP_BASE_PATH) {
    return "/";
  }

  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length);
  }

  return pathname;
}