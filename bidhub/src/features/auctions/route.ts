import { NextResponse } from "next/server";

import {
  AuctionError,
  createAuction,
} from "@/features/auctions/auction.service";

import {
  AuthorizationError,
  requireUser,
} from "@/features/auth/auth.guard";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "El cuerpo de la solicitud no es válido." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    const {
      title,
      description,
      startingPrice,
      minimumIncrement,
      endDate,
      categoryId,
      imageUrl,
    } = data;

    if (
      typeof title !== "string" ||
      typeof description !== "string" ||
      typeof startingPrice !== "number" ||
      typeof minimumIncrement !== "number" ||
      typeof endDate !== "string" ||
      typeof categoryId !== "string" ||
      (imageUrl !== undefined &&
        imageUrl !== null &&
        typeof imageUrl !== "string")
    ) {
      return NextResponse.json(
        { error: "Faltan datos o algunos tienen un formato incorrecto." },
        { status: 400 },
      );
    }

    const auction = await createAuction(
      {
        title,
        description,
        startingPrice,
        minimumIncrement,
        endDate,
        categoryId,
        ...(typeof imageUrl === "string" ? { imageUrl } : {}),
      },
      { userId: user.id },
    );

    return NextResponse.json(
      {
        message: "La subasta se publicó correctamente.",
        auction,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (
      error instanceof AuctionError ||
      error instanceof AuthorizationError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "El cuerpo de la solicitud contiene JSON inválido." },
        { status: 400 },
      );
    }

    console.error("Error al crear la subasta:", error);

    return NextResponse.json(
      { error: "Ocurrió un error interno al publicar la subasta." },
      { status: 500 },
    );
  }
}