import { NextResponse } from "next/server";
import {
  refreshUserSession,
  AuthError,
} from "@/features/auth/auth.service";



const isProduction = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");

    if (origin) {
      const expectedOrigin = new URL(request.url).origin;

      if (origin !== expectedOrigin) {
        return NextResponse.json(
          { error: "Solicitud no permitida." },
          { status: 403 },
        );
      }
    }

    const cookieHeader = request.headers.get("cookie") ?? "";

    const refreshCookie = cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("bidhub_refresh="));

    const refreshToken = refreshCookie
      ? decodeURIComponent(
          refreshCookie.slice("bidhub_refresh=".length),
        )
      : undefined;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "No hay una sesión renovable." },
        { status: 401 },
      );
    }

    const session = await refreshUserSession(refreshToken);

    const response = NextResponse.json({
      message: "Sesión renovada correctamente.",
      user: session.user,
    });

    response.cookies.set("bidhub_access", session.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });

    response.cookies.set("bidhub_refresh", session.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: unknown) {
    const response =
      error instanceof AuthError
        ? NextResponse.json(
            { error: error.message },
            { status: error.statusCode },
          )
        : NextResponse.json(
            { error: "No fue posible renovar la sesión." },
            { status: 401 },
          );

    response.cookies.set("bidhub_access", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set("bidhub_refresh", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  }
}