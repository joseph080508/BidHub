import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export class AuctionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AuctionError";
  }
}

const MIN_DURATION_MS = 60 * 60 * 1000;
const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_AUCTIONS = 5;

interface CreateAuctionInput {
  title: string;
  description: string;
  startingPrice: number;
  minimumIncrement: number;
  endDate: string;
  categoryId: string;
  imageUrl?: string;
}

interface CreateAuctionContext {
  userId: string;
}

export async function createAuction(
  input: CreateAuctionInput,
  context: CreateAuctionContext,
) {
  const title = input.title.trim();
  const description = input.description.trim();

  if (title.length < 5 || title.length > 120) {
    throw new AuctionError(
      "El título debe tener entre 5 y 120 caracteres.",
      400,
    );
  }

  if (description.length < 20 || description.length > 5000) {
    throw new AuctionError(
      "La descripción debe tener entre 20 y 5000 caracteres.",
      400,
    );
  }

  if (
    !Number.isFinite(input.startingPrice) ||
    input.startingPrice <= 0
  ) {
    throw new AuctionError(
      "El precio inicial debe ser mayor que cero.",
      400,
    );
  }

  if (
    !Number.isFinite(input.minimumIncrement) ||
    input.minimumIncrement <= 0
  ) {
    throw new AuctionError(
      "El incremento mínimo debe ser mayor que cero.",
      400,
    );
  }

  if (
    input.startingPrice > 9999999999.99 ||
    input.minimumIncrement > 9999999999.99
  ) {
    throw new AuctionError(
      "El precio supera el máximo permitido.",
      400,
    );
  }

  const endDate = new Date(input.endDate);
  const now = new Date();

  if (Number.isNaN(endDate.getTime())) {
    throw new AuctionError(
      "La fecha de cierre no es válida.",
      400,
    );
  }

  const duration = endDate.getTime() - now.getTime();

  if (duration < MIN_DURATION_MS || duration > MAX_DURATION_MS) {
    throw new AuctionError(
      "La subasta debe durar entre 1 hora y 7 días.",
      400,
    );
  }

  if (
    input.imageUrl !== undefined &&
    input.imageUrl.trim().length > 2048
  ) {
    throw new AuctionError(
      "La URL de la imagen es demasiado larga.",
      400,
    );
  }

  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new AuctionError(
      "La categoría seleccionada no existe.",
      400,
    );
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const activeAuctions = await tx.auction.count({
          where: {
            sellerId: context.userId,
            cancelledAt: null,
            startDate: { lte: now },
            endDate: { gt: now },
          },
        });

        if (activeAuctions >= MAX_ACTIVE_AUCTIONS) {
          throw new AuctionError(
            "No puedes tener más de 5 subastas activas.",
            409,
          );
        }

        return tx.auction.create({
          data: {
            title,
            description,
            startingPrice: new Prisma.Decimal(
              input.startingPrice.toFixed(2),
            ),
            minimumIncrement: new Prisma.Decimal(
              input.minimumIncrement.toFixed(2),
            ),
            endDate,
            sellerId: context.userId,
            categoryId: category.id,
            imageUrl: input.imageUrl?.trim() || null,
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
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    if (error instanceof AuctionError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new AuctionError(
        "La operación entró en conflicto con otra solicitud. Inténtalo nuevamente.",
        409,
      );
    }

    throw error;
  }
}