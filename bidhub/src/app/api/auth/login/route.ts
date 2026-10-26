import { NextResponse } from "next/server";
import { loginUser, AuthError } from "@/features/auth/auth.service";



const isProduction = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("email" in body) ||
      !("password" in body) ||
      typeof body.email !== "string" ||
      typeof body.password !== "string" ||
      body.email.length > 254 ||
      body.password.length === 0 ||
      body.password.length > 72
    ) {
      return NextResponse.json(
        { error: "Introduce un correo y una contraseña válidos." },
        { status: 400 },
      );
    }

    const session = await loginUser({
      email: body.email,
      password: body.password,
    });

    const response = NextResponse.json({
      message: "Inicio de sesión exitoso.",
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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Error en el inicio de sesión:", error);

    return NextResponse.json(
      { error: "No fue posible iniciar sesión." },
      { status: 500 },
    );
  }
}