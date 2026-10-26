import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { hash, compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  createAccessToken,
  createRefreshToken,
} from "@/lib/auth";

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (name.length < 2 || name.length > 80) {
    throw new AuthError("El nombre debe tener entre 2 y 80 caracteres.", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new AuthError("El correo electrónico no es válido.", 400);
  }

  if (input.password.length < 12 || input.password.length > 72) {
    throw new AuthError(
      "La contraseña debe tener entre 12 y 72 caracteres.",
      400,
    );
  }

  const passwordHash = await hash(input.password, 12);

  try {
    return await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "USER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AuthError("Este correo ya está registrado.", 409);
    }

    throw error;
  }
}

export async function loginUser(input: {
  email: string;
  password: string;
}) {
  const email = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await compare(input.password, user.passwordHash))) {
    throw new AuthError("Correo o contraseña incorrectos.", 401);
  }

  const accessToken = await createAccessToken({
    userId: user.id,
    role: user.role,
  });

  const refreshToken = await createRefreshToken({
    userId: user.id,
    role: user.role,
  });

  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.create({
    data: {
      tokenHash: refreshTokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function refreshUserSession(token: string) {
  const tokenHash = hashToken(token);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !storedToken ||
    storedToken.revokedAt ||
    storedToken.expiresAt <= new Date()
  ) {
    throw new AuthError("La sesión ha expirado. Inicia sesión nuevamente.", 401);
  }

  // Rotación del refresh token: el anterior deja de ser válido.
  const newRefreshToken = await createRefreshToken({
    userId: storedToken.user.id,
    role: storedToken.user.role,
  });

  const newRefreshTokenHash = hashToken(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const newAccessToken = await createAccessToken({
    userId: storedToken.user.id,
    role: storedToken.user.role,
  });

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: {
        id: storedToken.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (revoked.count !== 1) {
      throw new AuthError("La sesión ya fue utilizada o revocada.", 401);
    }

    await tx.refreshToken.create({
      data: {
        tokenHash: newRefreshTokenHash,
        userId: storedToken.user.id,
        expiresAt: newExpiresAt,
      },
    });
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: {
      id: storedToken.user.id,
      name: storedToken.user.name,
      email: storedToken.user.email,
      role: storedToken.user.role,
    },
  };
}

export async function logoutUser(token: string | undefined) {
  if (!token) {
    return;
  }

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}