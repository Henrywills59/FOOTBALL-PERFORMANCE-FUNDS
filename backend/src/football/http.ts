export type ProviderResponse<T> = {
  data: T;
  quota?: {
    remaining?: string | null;
    used?: string | null;
  };
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  attempts = 3,
): Promise<ProviderResponse<T>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const quota = {
        remaining:
          response.headers.get("x-ratelimit-requests-remaining") ??
          response.headers.get("x-requests-remaining"),
        used:
          response.headers.get("x-ratelimit-requests-used") ??
          response.headers.get("x-requests-used"),
      };

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Provider returned ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Provider request failed with ${response.status}`);
      }

      return {
        data: (await response.json()) as T,
        quota,
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(250 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Provider request failed");
}
