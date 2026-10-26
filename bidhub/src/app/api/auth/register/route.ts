import { NextResponse } from "next/server";
import { registerUser, AuthError } from "@/features/auth/auth.service";


export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("name" in body) ||
      !("email" in body) ||
      !("password" in body) ||
      typeof body.name !== "string" ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        { error: "Debes proporcionar nombre, correo y contraseña." },
        { status: 400 },
      );
    }

    const user = await registerUser({
      name: body.name,
      email: body.email,
      password: body.password,
    });

    return NextResponse.json(
      {
        message: "Cuenta creada correctamente.",
        user,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    console.error("Error al registrar usuario:", error);

    return NextResponse.json(
      { error: "No fue posible crear la cuenta." },
      { status: 500 },
    );
  }
}