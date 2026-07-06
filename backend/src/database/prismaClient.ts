import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  fpfPrisma?: PrismaClient;
};

export function getPrismaClient() {
  globalForPrisma.fpfPrisma ??= new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return globalForPrisma.fpfPrisma;
}
