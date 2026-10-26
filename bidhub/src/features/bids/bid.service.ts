import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export class BidError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "BidError";
  }
}

interface PlaceBidInput {
  auctionId: string;
  amount: number;
}

interface PlaceBidContext {
  userId: string;
}

export async function placeBid(
  input: PlaceBidInput,
  context: PlaceBidContext,
) {
  const { auctionId, amount } = input;

  if (!auctionId || typeof auctionId !== "string") {
    throw new BidError("El identificador de la subasta no es válido.", 400);
  }

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new BidError("El importe de la puja debe ser positivo.", 400);
  }

  if (amount > 9999999999.99) {
    throw new BidError("El importe supera el máximo permitido.", 400);
  }

  const amountInCents = Math.round(amount * 100);

  if (Math.abs(amount * 100 - amountInCents) > 0.000001) {
    throw new BidError(
      "El importe de la puja debe tener como máximo dos decimales.",
      400,
    );
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const now = new Date();

        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          select: {
            id: true,
            sellerId: true,
            startingPrice: true,
            minimumIncrement: true,
            startDate: true,
            endDate: true,
            cancelledAt: true,
            bids: {
              orderBy: { amount: "desc" },
              take: 1,
              select: {
                amount: true,
                userId: true,
              },
            },
          },
        });

        if (!auction) {
          throw new BidError("La subasta no existe.", 404);
        }

        if (auction.cancelledAt) {
          throw new BidError("La subasta ha sido cancelada.", 409);
        }

        if (auction.startDate > now || auction.endDate <= now) {
          throw new BidError(
            "La subasta no está abierta para recibir pujas.",
            409,
          );
        }

        if (auction.sellerId === context.userId) {
          throw new BidError(
            "No puedes pujar en tu propia subasta.",
            403,
          );
        }

        const highestBid = auction.bids[0];

        if (highestBid?.userId === context.userId) {
          throw new BidError(
            "Ya tienes la puja más alta y no puedes volver a pujar.",
            409,
          );
        }

        const minimumAllowed = highestBid
          ? highestBid.amount.toNumber() +
            auction.minimumIncrement.toNumber()
          : auction.startingPrice.toNumber();

        if (amountInCents < Math.round(minimumAllowed * 100)) {
          throw new BidError(
            `La puja mínima permitida es ${minimumAllowed.toFixed(2)}.`,
            400,
          );
        }

        const bid = await tx.bid.create({
          data: {
            auctionId: auction.id,
            userId: context.userId,
            amount: new Prisma.Decimal((amountInCents / 100).toFixed(2)),
          },
          select: {
            id: true,
            amount: true,
            createdAt: true,
            auctionId: true,
            userId: true,
          },
        });

        // Extender el cierre cinco minutos si la puja llega
        // durante los últimos cinco minutos de la subasta.
        const remainingTime = auction.endDate.getTime() - now.getTime();

        if (remainingTime <= 5 * 60 * 1000) {
          await tx.auction.update({
            where: { id: auction.id },
            data: {
              endDate: new Date(auction.endDate.getTime() + 5 * 60 * 1000),
            },
          });
        }

        return bid;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    if (error instanceof BidError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new BidError(
        "La subasta recibió otra puja simultáneamente. Inténtalo de nuevo.",
        409,
      );
    }

    throw error;
  }
}
