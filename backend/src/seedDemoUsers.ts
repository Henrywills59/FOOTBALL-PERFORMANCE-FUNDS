import "dotenv/config";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { defaultDemoUserPassword, demoUsers } from "./auth/demoUsers.js";

let seededPrisma: PrismaClient | null = null;

async function seedDemoUsers() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed demo users.");
  }

  if (process.env.NODE_ENV === "production" && process.env.FPF_ENABLE_DEMO_SEEDING !== "true") {
    throw new Error("Demo user seeding is disabled in production.");
  }

  const demoPassword = process.env.DEMO_USER_PASSWORD?.trim();
  if (!demoPassword && process.env.NODE_ENV === "production") {
    throw new Error("DEMO_USER_PASSWORD is required when production demo seeding is explicitly enabled.");
  }

  const { getPrismaClient } = await import("./database/prismaClient.js");
  const prisma = getPrismaClient();
  seededPrisma = prisma;
  const passwordHash = await bcrypt.hash(demoPassword || defaultDemoUserPassword, 12);

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
        status: "ACTIVE",
      },
      create: {
        ...user,
        passwordHash,
        status: "ACTIVE",
      },
    });
  }

  console.log(`Seeded ${demoUsers.length} demo users.`);
  console.log(`Demo password source: ${process.env.DEMO_USER_PASSWORD ? "DEMO_USER_PASSWORD" : "local development default"}`);
}

seedDemoUsers()
  .catch((error) => {
    console.error("Failed to seed demo users", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await seededPrisma?.$disconnect();
  });
