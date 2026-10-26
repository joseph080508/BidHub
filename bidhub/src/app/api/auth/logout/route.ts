import { NextResponse } from "next/server";
import { logoutUser } from "@/features/auth/auth.service";



const isProduction = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  try {
    // Validar el origen de la solicitud.
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

    // Obtener el refresh token desde la cookie.
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

    // Revocar la sesión en la base de datos.
    await logoutUser(refreshToken);

    // Eliminar las cookies de autenticación.
    const response = NextResponse.json({
      message: "Sesión cerrada correctamente.",
    });

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
  } catch (error: unknown) {
    console.error("Error al cerrar sesión:", error);

    return NextResponse.json(
      { error: "No fue posible cerrar la sesión." },
      { status: 500 },
    );
  }
}