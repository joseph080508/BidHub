import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AuctionError,
  createAuction,
} from "@/features/auctions/auction.service";
import {
  AuthorizationError,
  requireUser,
} from "@/features/auth/auth.guard";

export async function GET() {
  try {
    const auctions = await prisma.auction.findMany({
      where: {
        cancelledAt: null,
        startDate: { lte: new Date() },
        endDate: { gt: new Date() },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        startingPrice: true,
        minimumIncrement: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
          },
        },
        bids: {
          select: {
            amount: true,
          },
          orderBy: {
            amount: "desc",
          },
          take: 1,
        },
        _count: {
          select: {
            bids: true,
          },
        },
      },
    });

    return NextResponse.json({ auctions }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error al consultar las subastas:", error);

    return NextResponse.json(
      { error: "No se pudieron consultar las subastas." },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    // 1. Verificar que el usuario esté autenticado
    const user = await requireUser();

    // 2. Leer los datos enviados
    const body: unknown = await request.json();

    // 3. Validar que el cuerpo sea un objeto
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Los datos enviados no son válidos." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    // 4. Validar los campos obligatorios
    if (
      typeof data.title !== "string" ||
      typeof data.description !== "string" ||
      typeof data.startingPrice !== "number" ||
      typeof data.minimumIncrement !== "number" ||
      typeof data.endDate !== "string" ||
      typeof data.categoryId !== "string" ||
      (data.imageUrl !== undefined &&
        data.imageUrl !== null &&
        typeof data.imageUrl !== "string")
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios o tienen un formato incorrecto." },
        { status: 400 },
      );
    }

    // 5. Crear la subasta
    const auction = await createAuction(
      {
        title: data.title,
        description: data.description,
        startingPrice: data.startingPrice,
        minimumIncrement: data.minimumIncrement,
        endDate: data.endDate,
        categoryId: data.categoryId,
        imageUrl:
          typeof data.imageUrl === "string" ? data.imageUrl : undefined,
      },
      { userId: user.id },
    );

    return NextResponse.json({ auction }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuctionError) {
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

    console.error("Error al crear la subasta:", error);

    return NextResponse.json(
      { error: "No se pudo crear la subasta." },
      { status: 500 },
    );
  }
}