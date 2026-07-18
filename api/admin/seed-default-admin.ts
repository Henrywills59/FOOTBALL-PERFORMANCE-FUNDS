export default async function handler(request: unknown, response: unknown) {
  const { default: seedHandler } = await import("../../backend/api/admin/seed-default-admin.js");
  return seedHandler(request as never, response as never);
}
