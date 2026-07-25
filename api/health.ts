export default async function handler(request: unknown, response: unknown) {
  const { default: healthHandler } = await import("../backend/api/health.js");
  return healthHandler(request, response as never);
}
