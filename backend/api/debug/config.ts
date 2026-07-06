const defaultFrontendOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://football-performance-fund-frontend.vercel.app",
  "https://football-performance-funds-frontend.vercel.app",
  "https://we-are-starting-football-performanc.vercel.app",
];

function normalizeOrigin(origin: string) {
  const trimmed = origin.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

function allowedOrigins() {
  return [
    ...defaultFrontendOrigins,
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URLS,
    process.env.ALLOWED_ORIGINS,
  ]
    .flatMap((value) => (value ?? "").split(","))
    .map(normalizeOrigin)
    .filter(Boolean);
}

export default function handler(_request: unknown, response: { status: (code: number) => { json: (body: unknown) => void } }) {
  response.status(200).json({
    status: "ok",
    service: "football-performance-fund-api",
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    jwtSecretConfigured: Boolean(process.env.JWT_SECRET?.trim()),
    frontendUrlConfigured: Boolean(process.env.FRONTEND_URL?.trim()),
    allowedOriginsConfigured: Boolean(process.env.ALLOWED_ORIGINS?.trim()),
    allowedOrigins: allowedOrigins(),
    vercelPreviewOriginsAllowed: true,
  });
}
