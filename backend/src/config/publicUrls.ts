function clean(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function firstConfigured(names: string[]) {
  for (const name of names) {
    const value = clean(process.env[name]);
    if (value) return value;
  }
  return "";
}

export function getBackendBaseUrl() {
  const configured = process.env.VERCEL_ENV === "preview"
    ? firstConfigured([
      "BACKEND_BASE_URL",
      "VERCEL_URL",
      "BACKEND_PUBLIC_URL",
      "VERCEL_PROJECT_PRODUCTION_URL",
    ])
    : firstConfigured([
      "BACKEND_BASE_URL",
      "BACKEND_PUBLIC_URL",
      "VERCEL_PROJECT_PRODUCTION_URL",
      "VERCEL_URL",
    ]);
  return configured ? normalizeUrl(configured) : "http://localhost:3000";
}

export function getFrontendBaseUrl() {
  const configured = firstConfigured([
    "FRONTEND_URL",
    "FRONTEND_BASE_URL",
    "APP_BASE_URL",
    "PUBLIC_APP_URL",
  ]);
  return configured ? normalizeUrl(configured) : "http://localhost:5173";
}

export function buildFrontendUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getFrontendBaseUrl()}${normalizedPath}`;
}

export function buildBackendUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBackendBaseUrl()}${normalizedPath}`;
}
