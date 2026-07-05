import "dotenv/config";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { defaultDemoUserPassword, demoUsers } from "./auth/demoUsers.js";

const demoPassword = process.env.DEMO_USER_PASSWORD ?? defaultDemoUserPassword;

let seededPrisma: PrismaClient | null = null;

async function seedDemoUsers() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed demo users.");
  }

  const { prisma } = await import("./database/prismaClient.js");
  seededPrisma = prisma;
  const passwordHash = await bcrypt.hash(demoPassword, 12);

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
  console.log(`Demo password source: ${process.env.DEMO_USER_PASSWORD ? "DEMO_USER_PASSWORD" : "default Password123"}`);
}

seedDemoUsers()
  .catch((error) => {
    console.error("Failed to seed demo users", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await seededPrisma?.$disconnect();
  });
