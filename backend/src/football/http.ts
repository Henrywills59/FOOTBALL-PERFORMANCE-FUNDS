export type ProviderResponse<T> = {
  data: T;
  quota?: {
    remaining?: string | null;
    used?: string | null;
    limit?: string | null;
  };
  responseTimeMs: number;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly rateLimited = false,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  attempts = 3,
  timeoutMs = 8000,
): Promise<ProviderResponse<T>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const quota = {
        remaining:
          response.headers.get("x-ratelimit-requests-remaining") ??
          response.headers.get("x-requests-remaining"),
        used:
          response.headers.get("x-ratelimit-requests-used") ??
          response.headers.get("x-requests-used"),
        limit:
          response.headers.get("x-ratelimit-requests-limit") ??
          response.headers.get("x-requests-limit"),
      };

      if (response.status === 429 || response.status >= 500) {
        throw new ProviderRequestError(`Provider returned ${response.status}`, response.status, response.status === 429);
      }

      if (!response.ok) {
        throw new ProviderRequestError(`Provider request failed with ${response.status}`, response.status);
      }

      return {
        data: (await response.json()) as T,
        quota,
        responseTimeMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(250 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Provider request failed");
}
