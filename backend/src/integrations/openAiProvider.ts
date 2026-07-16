type OpenAiResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
};

export type OpenAiIntegrationStatus = {
  configured: boolean;
  model: string;
  baseUrl: string;
  missingVariables: string[];
};

export type OpenAiInsightRequest = {
  task: "ANALYST_ASSISTANT" | "MATCH_SUMMARY" | "INTERNAL_REPORT" | "CONTRADICTION_DETECTION";
  prompt: string;
  context: Record<string, unknown>;
};

export type OpenAiInsightResponse = {
  provider: "OPENAI";
  mode: "LIVE" | "SAFE_FALLBACK";
  text: string;
  warnings: string[];
};

function clean(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function extractText(data: OpenAiResponse) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const content = data.output?.flatMap((item) => item.content ?? []) ?? [];
  const text = content.map((item) => item.text).filter(Boolean).join("\n").trim();
  return text || "OpenAI response did not include text output.";
}

export class OpenAiProvider {
  private readonly apiKey = clean(process.env.OPENAI_API_KEY) || undefined;
  private readonly model = clean(process.env.OPENAI_MODEL, "gpt-4.1-mini");
  private readonly baseUrl = clean(process.env.OPENAI_BASE_URL, "https://api.openai.com");
  private readonly timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 12000);

  status(): OpenAiIntegrationStatus {
    const missingVariables = [!this.apiKey ? "OPENAI_API_KEY" : null].filter((item): item is string => Boolean(item));
    return {
      configured: missingVariables.length === 0,
      model: this.model,
      baseUrl: this.baseUrl,
      missingVariables,
    };
  }

  async generateInsight(input: OpenAiInsightRequest): Promise<OpenAiInsightResponse> {
    const status = this.status();
    if (!status.configured) {
      return {
        provider: "OPENAI",
        mode: "SAFE_FALLBACK",
        text: this.fallback(input),
        warnings: [`OpenAI is not configured. Missing ${status.missingVariables.join(", ")}.`],
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(new URL("/v1/responses", this.baseUrl), {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            {
              role: "system",
              content: "You are FPF's private internal football intelligence assistant. Never guarantee outcomes, never invent facts, and clearly flag missing evidence.",
            },
            {
              role: "user",
              content: `${input.prompt}\n\nContext JSON:\n${JSON.stringify(input.context).slice(0, 12000)}`,
            },
          ],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          provider: "OPENAI",
          mode: "SAFE_FALLBACK",
          text: this.fallback(input),
          warnings: [`OpenAI request failed with HTTP ${response.status}.`],
        };
      }
      return {
        provider: "OPENAI",
        mode: "LIVE",
        text: extractText(data as OpenAiResponse),
        warnings: [],
      };
    } catch (error) {
      return {
        provider: "OPENAI",
        mode: "SAFE_FALLBACK",
        text: this.fallback(input),
        warnings: [error instanceof Error && error.name === "AbortError" ? "OpenAI request timed out." : "OpenAI provider unavailable."],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private fallback(input: OpenAiInsightRequest) {
    if (input.task === "CONTRADICTION_DETECTION") return "Safe fallback: review confidence, risk level, selected market, and evidence notes for contradictions before publication.";
    if (input.task === "INTERNAL_REPORT") return "Safe fallback: internal report generation is provider-ready and awaiting OpenAI configuration.";
    if (input.task === "MATCH_SUMMARY") return "Safe fallback: match summary requires configured AI provider or verified football data.";
    return "Safe fallback: analyst assistant is provider-ready. Use team form, head-to-head, injuries, odds, and evidence notes manually until OpenAI is configured.";
  }
}
