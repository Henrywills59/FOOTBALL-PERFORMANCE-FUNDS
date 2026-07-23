export default async function handler(request: unknown, response: unknown) {
  const { default: healthDbHandler } = await import("../../backend/api/health/db.js");
  return healthDbHandler(request, response as never);
}
