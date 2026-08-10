import "dotenv/config";
import bcrypt from "bcryptjs";
import { getPrismaClient } from "./database/prismaClient.js";
import { getDefaultAdminSeed } from "./auth/adminSeed.js";

let prisma: ReturnType<typeof getPrismaClient> | null = null;

async function seedDefaultAdmin() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the default admin account.");
  }

  const defaultAdminSeed = getDefaultAdminSeed();
  prisma = getPrismaClient();
  const activeAdminCount = await prisma.user.count({
    where: {
      status: "ACTIVE",
      role: { in: ["ADMIN", "SUPER_ADMINISTRATOR"] },
    },
  });
  if (activeAdminCount > 0) {
    console.log("Default admin seed skipped: an active administrator already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash(defaultAdminSeed.password, 12);
  await prisma.user.create({
    data: {
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
