export const defaultDemoUserPassword = "Password123";

export const demoUsers = [
  {
    name: "FPF Admin",
    email: "admin@footballperformancefund.com",
    role: "ADMIN" as const,
  },
  {
    name: "FPF Investor",
    email: "investor@footballperformancefund.com",
    role: "INVESTOR" as const,
  },
  {
    name: "FPF Subscriber",
    email: "subscriber@footballperformancefund.com",
    role: "SUBSCRIBER" as const,
  },
];
