import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get("bidhub_access")?.value;

  const isAdminRoute = pathname.startsWith("/admin");
  const isPrivateRoute =
    pathname.startsWith("/mi-cuenta") ||
    pathname.startsWith("/mis-subastas") ||
    pathname.startsWith("/mis-pujas");

  if (!isAdminRoute && !isPrivateRoute) {
    return NextResponse.next();
  }

  if (!accessToken) {
    return redirectToLogin(request);
  }

  const payload = await verifyAccessToken(accessToken);

  if (!payload) {
    return redirectToLogin(request);
  }

  if (isAdminRoute && payload.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/403", request.url));
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/mi-cuenta/:path*",
    "/mis-subastas/:path*",
    "/mis-pujas/:path*",
  ],
};