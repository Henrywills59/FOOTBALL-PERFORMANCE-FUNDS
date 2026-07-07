export function isPrismaOptionalDataError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  return ["P2021", "P2022", "P2023", "P2010"].includes(code);
}

export function logOptionalDataFallback(scope: string, error: unknown) {
  const details =
    error instanceof Error
      ? {
          name: error.constructor.name,
          message: error.message,
          code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
        }
      : { message: "Unknown optional data error" };

  console.warn("Optional dashboard data unavailable; returning safe defaults", {
    scope,
    error: details,
  });
}
