type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
  if (!(error instanceof Error)) return { message: "Unknown error" };

  return {
    name: error.constructor.name,
    message: error.message,
    code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
  };
}

export const intelligenceLogger = {
  cacheMiss(key: string) {
    console.info("INTELLIGENCE_CACHE_MISS", { key });
  },

  apiFailure(endpoint: string, error: unknown, context: LogContext = {}) {
    console.error("INTELLIGENCE_API_FAILURE", {
      endpoint,
      error: serializeError(error),
      ...context,
    });
  },

  providerFailure(provider: string, error: unknown, context: LogContext = {}) {
    console.warn("INTELLIGENCE_PROVIDER_FAILURE", {
      provider,
      error: serializeError(error),
      ...context,
    });
  },

  responseTime(endpoint: string, startedAt: number, context: LogContext = {}) {
    console.info("INTELLIGENCE_RESPONSE_TIME", {
      endpoint,
      durationMs: Date.now() - startedAt,
      ...context,
    });
  },
};

