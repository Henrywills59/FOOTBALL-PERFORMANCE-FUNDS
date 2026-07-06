import "dotenv/config";
import bcrypt from "bcryptjs";
import { getPrismaClient } from "./database/prismaClient.js";
import { defaultAdminSeed } from "./auth/adminSeed.js";

let prisma: ReturnType<typeof getPrismaClient> | null = null;

async function seedDefaultAdmin() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the default admin account.");
  }

  prisma = getPrismaClient();
  const passwordHash = await bcrypt.hash(defaultAdminSeed.password, 12);
  await prisma.user.upsert({
    where: { email: defaultAdminSeed.email },
    update: {
      name: defaultAdminSeed.name,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      name: defaultAdminSeed.name,
      email: defaultAdminSeed.email,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Seeded default admin account: ${defaultAdminSeed.email}`);
}

seedDefaultAdmin()
  .catch((error) => {
    console.error("Failed to seed default admin account", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
