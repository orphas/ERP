import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { stripBasePath } from "@/lib/base-path";
import { canAccessApi, canAccessPage } from "@/lib/rbac";

const PUBLIC_PATHS = ["/login"];

function isStaticPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/static")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const appPathname = stripBasePath(pathname);

  if (isStaticPath(appPathname) || appPathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(appPathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await verifySessionToken(token);

  if (!user) {
    if (appPathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", appPathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  }

  if (appPathname.startsWith("/api")) {
    if (!canAccessApi(user.role, appPathname, request.method)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!canAccessPage(user.role, appPathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
