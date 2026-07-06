export const defaultAdminSeed = {
  name: process.env.DEFAULT_ADMIN_NAME ?? "FPF Admin",
  email: process.env.DEFAULT_ADMIN_EMAIL ?? "admin@footballperformancefund.com",
  password: process.env.DEFAULT_ADMIN_PASSWORD ?? process.env.DEMO_USER_PASSWORD ?? "Password123",
};
