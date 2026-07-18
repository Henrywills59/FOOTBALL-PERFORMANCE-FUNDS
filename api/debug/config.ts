export default async function handler(request: unknown, response: unknown) {
  const { default: configHandler } = await import("../../backend/api/debug/config.js");
  return configHandler(request, response as never);
}
