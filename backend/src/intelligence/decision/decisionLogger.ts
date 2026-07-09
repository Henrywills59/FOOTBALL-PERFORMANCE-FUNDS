type Context = Record<string, unknown>;

function safeError(error: unknown) {
  if (!(error instanceof Error)) return { message: "Unknown error" };
  return { name: error.constructor.name, message: error.message };
}

export const decisionLogger = {
  started(context: Context) {
    console.info("DECISION_ENGINE_RUN_STARTED", context);
  },
  completed(context: Context) {
    console.info("DECISION_ENGINE_RUN_COMPLETED", context);
  },
  matchEvaluated(context: Context) {
    console.info("DECISION_ENGINE_MATCH_EVALUATED", context);
  },
  fallback(context: Context) {
    console.warn("DECISION_ENGINE_MISSING_DATA_FALLBACK", context);
  },
  providerUnavailable(context: Context) {
    console.warn("DECISION_ENGINE_PROVIDER_UNAVAILABLE", context);
  },
  scoreError(error: unknown, context: Context) {
    console.error("DECISION_ENGINE_SCORE_ERROR", { ...context, error: safeError(error) });
  },
};

