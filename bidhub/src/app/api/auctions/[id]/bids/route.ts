import { NextResponse } from "next/server";

import {
  BidError,
  placeBid,
} from "@/features/bids/bid.service";

import {
  AuthorizationError,
  requireUser,
} from "@/features/auth/auth.guard";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  try {
    // 1. Verificar que el usuario esté autenticado.
    const user = await requireUser();

    // 2. Obtener el ID de la subasta de la URL.
    const { id: auctionId } = await params;

    if (!auctionId || typeof auctionId !== "string") {
      return NextResponse.json(
        { error: "El identificador de la subasta no es válido." },
        { status: 400 },
      );
    }

    // 3. Leer y validar el cuerpo de la solicitud.
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Los datos enviados no son válidos." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    if (
      typeof data.amount !== "number" ||
      !Number.isFinite(data.amount)
    ) {
      return NextResponse.json(
        { error: "Debes indicar un importe de puja válido." },
        { status: 400 },
      );
    }

    // 4. Registrar la puja mediante el servicio.
    const bid = await placeBid(
      {
        auctionId,
        amount: data.amount,
      },
      {
        userId: user.id,
      },
    );

    // 5. Devolver la puja creada.
    return NextResponse.json({ bid }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof BidError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "El cuerpo de la solicitud no contiene JSON válido." },
        { status: 400 },
      );
    }

    console.error("Error al registrar la puja:", error);

    return NextResponse.json(
      { error: "No se pudo registrar la puja." },
      { status: 500 },
    );
  }}