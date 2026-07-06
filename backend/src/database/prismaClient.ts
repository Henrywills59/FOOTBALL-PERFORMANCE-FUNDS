import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  fpfPrisma?: PrismaClient;
};

export function isDatabaseUrlConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPrismaClient() {
  globalForPrisma.fpfPrisma ??= new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return globalForPrisma.fpfPrisma;
}

export async function checkPrismaConnection() {
  if (!isDatabaseUrlConfigured()) {
    return {
      ok: false,
      message: "DATABASE_URL is not configured.",
    };
  }

  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return {
      ok: true,
      message: "Prisma connected successfully.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Prisma connection failed.",
    };
  }
}
