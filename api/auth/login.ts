export default async function handler(request: unknown, response: unknown) {
  const { default: loginHandler } = await import("../../backend/api/auth/login.js");
  return loginHandler(request as never, response as never);
}
