import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  fpfPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.fpfPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.fpfPrisma = prisma;
}
