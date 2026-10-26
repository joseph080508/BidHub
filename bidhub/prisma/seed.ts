import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hash } from "bcryptjs";

const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("Falta configurar DIRECT_URL en el archivo .env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando seed de BidHub...");

  // 1. Crear el administrador
  const adminName = process.env.ADMIN_NAME;
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminName || !adminEmail || !adminPassword) {
    throw new Error(
      "Configura ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD en .env",
    );
  }

  const adminPasswordHash = await hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: "ADMIN",
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  console.log(`Administrador preparado: ${admin.email}`);

  // 2. Crear categorías
  const categoryData = [
    {
      name: "Monedas y billetes",
      slug: "monedas-billetes",
      description: "Monedas y billetes de colección.",
    },
    {
      name: "Figuras coleccionables",
      slug: "figuras-coleccionables",
      description: "Figuras, miniaturas y personajes.",
    },
    {
      name: "Tarjetas coleccionables",
      slug: "tarjetas-coleccionables",
      description: "Tarjetas deportivas y de colección.",
    },
    {
      name: "Arte y antigüedades",
      slug: "arte-antiguedades",
      description: "Objetos artísticos y antigüedades.",
    },
  ];

  const categories = [];

  for (const category of categoryData) {
    const savedCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
      },
      create: category,
    });

    categories.push(savedCategory);
  }

  console.log(`${categories.length} categorías preparadas.`);

  // 3. Crear usuarios de prueba
  // Sus contraseñas aleatorias solo se almacenan como hashes.
  // Estos usuarios son para datos de prueba, no para iniciar sesión.

  const demoSellerEmail = "vendedor.demo@bidhub.local";
  const demoBidderEmail = "comprador.demo@bidhub.local";

  const demoSeller = await prisma.user.upsert({
    where: { email: demoSellerEmail },
    update: {},
    create: {
      name: "Vendedor de prueba",
      email: demoSellerEmail,
      passwordHash: await hash(
        crypto.randomUUID(),
        12,
      ),
      role: "USER",
    },
  });

  const demoBidder = await prisma.user.upsert({
    where: { email: demoBidderEmail },
    update: {},
    create: {
      name: "Comprador de prueba",
      email: demoBidderEmail,
      passwordHash: await hash(
        crypto.randomUUID(),
        12,
      ),
      role: "USER",
    },
  });

  // 4. Preparar las fechas de prueba
  const now = new Date();

  const futureDate = new Date(
    now.getTime() + 24 * 60 * 60 * 1000,
  );

  const pastStartDate = new Date(
    now.getTime() - 3 * 24 * 60 * 60 * 1000,
  );

  const pastEndDate = new Date(
    now.getTime() - 60 * 60 * 1000,
  );

  // 5. Crear subastas de ejemplo de forma idempotente
  async function ensureAuction(data: {
    title: string;
    description: string;
    startingPrice: string;
    minimumIncrement: string;
    startDate: Date;
    endDate: Date;
    sellerId: string;
    categoryId: string;
    cancelledAt?: Date;
  }) {
    const existing = await prisma.auction.findFirst({
      where: {
        title: data.title,
        sellerId: data.sellerId,
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.auction.create({
      data: {
        ...data,
        startingPrice: data.startingPrice,
        minimumIncrement: data.minimumIncrement,
      },
    });
  }

  const activeAuction = await ensureAuction({
    title: "Moneda conmemorativa de colección",
    description:
      "Moneda conmemorativa para coleccionistas. Subasta de demostración.",
    startingPrice: "50000.00",
    minimumIncrement: "5000.00",
    startDate: now,
    endDate: futureDate,
    sellerId: demoSeller.id,
    categoryId: categories[0].id,
  });

  const closedAuction = await ensureAuction({
    title: "Figura coleccionable edición especial",
    description:
      "Figura de edición especial. Subasta de demostración finalizada.",
    startingPrice: "80000.00",
    minimumIncrement: "5000.00",
    startDate: pastStartDate,
    endDate: pastEndDate,
    sellerId: demoSeller.id,
    categoryId: categories[1].id,
  });

  const desertedAuction = await ensureAuction({
    title: "Tarjeta coleccionable sin ofertas",
    description:
      "Subasta de demostración que finalizó sin recibir ofertas.",
    startingPrice: "20000.00",
    minimumIncrement: "2000.00",
    startDate: pastStartDate,
    endDate: pastEndDate,
    sellerId: demoSeller.id,
    categoryId: categories[2].id,
  });

  const cancelledAuction = await ensureAuction({
    title: "Antigüedad de demostración cancelada",
    description:
      "Subasta de prueba cancelada por el administrador.",
    startingPrice: "100000.00",
    minimumIncrement: "10000.00",
    startDate: pastStartDate,
    endDate: futureDate,
    sellerId: demoSeller.id,
    categoryId: categories[3].id,
    cancelledAt: now,
  });

  // 6. Crear ofertas de prueba sin duplicarlas
  const existingBid = await prisma.bid.findFirst({
    where: {
      auctionId: closedAuction.id,
      userId: demoBidder.id,
    },
  });

  if (!existingBid) {
    await prisma.bid.create({
      data: {
        amount: "80000.00",
        auctionId: closedAuction.id,
        userId: demoBidder.id,
        createdAt: new Date(
          pastEndDate.getTime() - 60 * 60 * 1000,
        ),
      },
    });

    await prisma.bid.create({
      data: {
        amount: "85000.00",
        auctionId: closedAuction.id,
        userId: admin.id,
        createdAt: new Date(
          pastEndDate.getTime() - 30 * 60 * 1000,
        ),
      },
    });
  }

  // 7. Registrar la cancelación administrativa
  await prisma.auctionCancellation.upsert({
    where: { auctionId: cancelledAuction.id },
    update: {},
    create: {
      auctionId: cancelledAuction.id,
      adminId: admin.id,
      reason: "Cancelación de demostración para pruebas.",
    },
  });

  console.log("Subastas de prueba preparadas:");
  console.log(`- Activa: ${activeAuction.title}`);
  console.log(`- Cerrada: ${closedAuction.title}`);
  console.log(`- Desierta: ${desertedAuction.title}`);
  console.log(`- Cancelada: ${cancelledAuction.title}`);

  console.log("Seed de BidHub completado.");
}

main()
  .catch((error: unknown) => {
    console.error("Error ejecutando el seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });