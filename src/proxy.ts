import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/backend/lib/session";
import { canOpenPage } from "@/lib/access";

/** Public website: marketplace, shop, seller accounts, auth screens. */
const publicPaths = ["/", "/login", "/setup", "/cars", "/bikes", "/sell-car", "/shop", "/post-ad", "/account"];

/** APIs reachable without a staff session (they do their own checks). */
const publicApi = ["/api/auth", "/api/site"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    publicApi.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/uploads/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isPublic = publicPaths.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));

  if (isPublic) {
    if (session && (pathname === "/login" || pathname === "/setup")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!pathname.startsWith("/api/") && !canOpenPage(session.role, pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
