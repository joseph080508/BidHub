import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("bidhub_access")?.value;

  if (!accessToken) {
    throw new AuthorizationError("Debes iniciar sesión.", 401);
  }

  const payload = await verifyAccessToken(accessToken);

  if (!payload) {
    throw new AuthorizationError(
      "La sesión no es válida o ha expirado.",
      401,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throw new AuthorizationError("Usuario no encontrado.", 401);
  }

  return user;
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    throw new AuthorizationError(
      "No tienes permisos para realizar esta operación.",
      403,
    );
  }

  return user;
}