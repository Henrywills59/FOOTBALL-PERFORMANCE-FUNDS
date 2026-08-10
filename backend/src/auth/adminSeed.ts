export function getDefaultAdminSeed() {
  const password = process.env.DEFAULT_ADMIN_PASSWORD?.trim();
  if (!password && process.env.NODE_ENV === "production") {
    throw new Error("DEFAULT_ADMIN_PASSWORD is required for production admin bootstrap.");
  }

  return {
    name: process.env.DEFAULT_ADMIN_NAME ?? "FPF Admin",
    email: process.env.DEFAULT_ADMIN_EMAIL ?? "admin@footballperformancefund.com",
    password: password || "local-development-admin-password",
  };
}
