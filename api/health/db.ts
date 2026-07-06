export default async function handler(
  _request: unknown,
  response: { status: (code: number) => { json: (body: unknown) => void } },
) {
  try {
    const { checkPrismaConnection, isDatabaseUrlConfigured } = await import("../../backend/src/database/prismaClient.js");
    const database = await checkPrismaConnection();
    response.status(database.ok ? 200 : 503).json({
      status: database.ok ? "ok" : "degraded",
      service: "football-performance-fund-api",
      databaseUrlConfigured: isDatabaseUrlConfigured(),
      prisma: database,
    });
  } catch (error) {
    response.status(503).json({
      status: "degraded",
      service: "football-performance-fund-api",
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
      prisma: {
        ok: false,
        message: error instanceof Error ? error.message : "Database health check failed.",
      },
    });
  }
}
