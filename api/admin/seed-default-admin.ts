import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
  setHeader?: (name: string, value: string) => void;
};

function getHeader(request: VercelRequest, name: string) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function parseBody(body: unknown) {
  if (typeof body === "string") {
    return JSON.parse(body) as Record<string, unknown>;
  }

  if (typeof body === "object" && body !== null) {
    return body as Record<string, unknown>;
  }

  return {};
}

function safeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: "Unknown error" };
  }

  return {
    name: error.constructor.name,
    message: error.message,
    code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader?.("access-control-allow-methods", "POST,OPTIONS");
  response.setHeader?.("access-control-allow-headers", "content-type,x-admin-seed-token");

  if (request.method === "OPTIONS") {
    response.status(200).json({ ok: true });
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "Method not allowed." });
    return;
  }

  const expectedToken = process.env.ADMIN_SEED_TOKEN?.trim();
  const providedToken = getHeader(request, "x-admin-seed-token")?.trim();

  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    response.status(404).json({ ok: false, message: "Not found." });
    return;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    response.status(500).json({
      ok: false,
      failedStage: "environment",
      databaseUrlConfigured: false,
    });
    return;
  }

  let prisma: PrismaClient | null = null;
  try {
    prisma = new PrismaClient({ log: ["error"] });
    const body = parseBody(request.body);
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "admin@footballperformancefund.com";
    const password =
      typeof body.password === "string" && body.password.length > 0
        ? body.password
        : "ChooseAStrongPassword123!";
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "FPF Admin";

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
      create: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    response.status(200).json({
      ok: true,
      seeded: true,
      user,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      failedStage: "adminSeed",
      error: safeError(error),
    });
  } finally {
    try {
      await prisma?.$disconnect();
    } catch {
      // Cleanup must not hide the seed result from the deploy report.
    }
  }
}
