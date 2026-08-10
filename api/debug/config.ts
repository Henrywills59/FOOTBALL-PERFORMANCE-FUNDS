export default async function handler(request: unknown, response: unknown) {
  if (process.env.NODE_ENV === "production") {
    (response as { status: (code: number) => { json: (body: unknown) => void } })
      .status(404)
      .json({ error: "Not found" });
    return;
  }

  const { default: configHandler } = await import("../../backend/api/debug/config.js");
  return configHandler(request, response as never);
}
