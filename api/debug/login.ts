export default async function handler(request: unknown, response: unknown) {
  const { default: debugLoginHandler } = await import("../../backend/api/debug/login.js");
  return debugLoginHandler(request as never, response as never);
}
