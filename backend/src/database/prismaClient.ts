import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  fpfPrisma?: PrismaClient;
};

function prismaRuntimeUrl() {
  const rawUrl = process.env.DATABASE_URL?.trim();
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "5");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function isDatabaseUrlConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPrismaClient() {
  if (!globalForPrisma.fpfPrisma) {
    console.info("Initializing Prisma client", {
      databaseUrlConfigured: isDatabaseUrlConfigured(),
      nodeEnv: process.env.NODE_ENV ?? "development",
    });

    globalForPrisma.fpfPrisma = new PrismaClient({
      datasources: {
        db: {
          url: prismaRuntimeUrl(),
        },
      },
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

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
    console.info("Prisma health check succeeded", {
      databaseUrlConfigured: true,
    });
    return {
      ok: true,
      message: "Prisma connected successfully.",
    };
  } catch (error) {
    console.error("Prisma health check failed", {
      databaseUrlConfigured: true,
      message: error instanceof Error ? error.message : "Prisma connection failed.",
      code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
    });
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Prisma connection failed.",
    };
  }
}
