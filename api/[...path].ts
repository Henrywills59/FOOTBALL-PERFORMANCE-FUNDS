export default async function handler(request: unknown, response: unknown) {
  const { default: backendHandler } = await import("../backend/api/index.js");
  return backendHandler(request as never, response as never);
}
