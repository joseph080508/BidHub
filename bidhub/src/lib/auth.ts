import { SignJWT, jwtVerify } from "jose";

const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;

if (!accessSecret || !refreshSecret) {
  throw new Error("Faltan JWT_ACCESS_SECRET o JWT_REFRESH_SECRET en .env");
}

const ACCESS_KEY = new TextEncoder().encode(accessSecret);
const REFRESH_KEY = new TextEncoder().encode(refreshSecret);

export interface TokenPayload {
  userId: string;
  role: "USER" | "ADMIN";
}

export async function createAccessToken(payload: TokenPayload) {
  return new SignJWT({
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(ACCESS_KEY);
}

export async function createRefreshToken(payload: TokenPayload) {
  return new SignJWT({
    role: payload.role,
    type: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(REFRESH_KEY);
}

export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, ACCESS_KEY, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "USER" && payload.role !== "ADMIN")
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
    } satisfies TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, REFRESH_KEY, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "USER" && payload.role !== "ADMIN") ||
      payload.type !== "refresh"
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
    } satisfies TokenPayload;
  } catch {
    return null;
  }
}