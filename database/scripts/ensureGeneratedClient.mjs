import { existsSync } from "node:fs";
import { resolve } from "node:path";

const generatedClient = resolve(process.cwd(), "../node_modules/.prisma/client/default.d.ts");

if (!existsSync(generatedClient)) {
  console.error("Prisma generate failed and no generated Prisma Client was found.");
  process.exit(1);
}

console.warn("Prisma generate failed; using existing generated Prisma Client.");
