import { z } from "zod";

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
  task:
    | "ANALYST_ASSISTANT"
    | "MATCH_SUMMARY"
    | "INTERNAL_REPORT"
    | "CONTRADICTION_DETECTION"
    | "SUPPORTING_OPPOSING_EVIDENCE"
    | "POST_MATCH_REVIEW";
  prompt: string;
  context: Record<string, unknown>;
};

const structuredInsightSchema = z.object({
  summary: z.string().max(2000),
  keyFindings: z.array(z.string().max(300)).max(10).default([]),
  supportingEvidence: z.array(z.string().max(300)).max(10).default([]),
  opposingEvidence: z.array(z.string().max(300)).max(10).default([]),
  missingData: z.array(z.string().max(300)).max(10).default([]),
  contradictions: z.array(z.string().max(300)).max(10).default([]),
  riskWarnings: z.array(z.string().max(300)).max(10).default([]),
  recommendedNextActions: z.array(z.string().max(300)).max(10).default([]),
});

export type StructuredOpenAiInsight = z.infer<typeof structuredInsightSchema>;

export type OpenAiInsightResponse = {
  provider: "OPENAI";
  mode: "LIVE" | "SAFE_FALLBACK";
  text: string;
  structured: StructuredOpenAiInsight;
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

function parseStructuredInsight(text: string): StructuredOpenAiInsight | null {
  try {
    return structuredInsightSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

function structuredFallback(text: string): StructuredOpenAiInsight {
  return {
    summary: text,
    keyFindings: [],
    supportingEvidence: [],
    opposingEvidence: [],
    missingData: ["Live provider evidence may be incomplete or unavailable."],
    contradictions: [],
    riskWarnings: ["This output is advisory only and cannot approve selections, settle results, calculate distributions, or authorize company capital."],
    recommendedNextActions: ["Verify source football data before operational use."],
  };
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
      const text = this.fallback(input);
      return {
        provider: "OPENAI",
        mode: "SAFE_FALLBACK",
        text,
        structured: structuredFallback(text),
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
          text: {
            format: {
              type: "json_schema",
              name: "fpf_internal_intelligence",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["summary", "keyFindings", "supportingEvidence", "opposingEvidence", "missingData", "contradictions", "riskWarnings", "recommendedNextActions"],
                properties: {
                  summary: { type: "string" },
                  keyFindings: { type: "array", items: { type: "string" } },
                  supportingEvidence: { type: "array", items: { type: "string" } },
                  opposingEvidence: { type: "array", items: { type: "string" } },
                  missingData: { type: "array", items: { type: "string" } },
                  contradictions: { type: "array", items: { type: "string" } },
                  riskWarnings: { type: "array", items: { type: "string" } },
                  recommendedNextActions: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
          input: [
            {
              role: "system",
              content: [
                "You are FPF's private internal football intelligence assistant.",
                "Use only the supplied context.",
                "Never invent fixtures, injuries, statistics, odds, probabilities, or unavailable evidence.",
                "Never approve selections, settle results, calculate distributions, or authorize company capital.",
                "Return valid JSON matching the schema and clearly flag missing evidence.",
              ].join(" "),
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
          structured: structuredFallback(this.fallback(input)),
        };
      }
      const text = extractText(data as OpenAiResponse);
      const structured = parseStructuredInsight(text);
      if (!structured) {
        const fallbackText = this.fallback(input);
        console.error("OPENAI_STRUCTURED_VALIDATION_FAILED", { task: input.task, model: this.model });
        return {
          provider: "OPENAI",
          mode: "SAFE_FALLBACK",
          text: fallbackText,
          structured: structuredFallback(fallbackText),
          warnings: ["OpenAI response failed structured validation."],
        };
      }
      return {
        provider: "OPENAI",
        mode: "LIVE",
        text: structured.summary,
        structured,
        warnings: [],
      };
    } catch (error) {
      const text = this.fallback(input);
      return {
        provider: "OPENAI",
        mode: "SAFE_FALLBACK",
        text,
        structured: structuredFallback(text),
        warnings: [error instanceof Error && error.name === "AbortError" ? "OpenAI request timed out." : "OpenAI provider unavailable."],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private fallback(input: OpenAiInsightRequest) {
    if (input.task === "CONTRADICTION_DETECTION") return "Safe fallback: review confidence, risk level, selected market, and evidence notes for contradictions before publication.";
    if (input.task === "SUPPORTING_OPPOSING_EVIDENCE") return "Safe fallback: compare supporting and opposing evidence manually using verified football data only.";
    if (input.task === "POST_MATCH_REVIEW") return "Safe fallback: post-match review synthesis is provider-ready and awaiting verified result data.";
    if (input.task === "INTERNAL_REPORT") return "Safe fallback: internal report generation is provider-ready and awaiting OpenAI configuration.";
    if (input.task === "MATCH_SUMMARY") return "Safe fallback: match summary requires configured AI provider or verified football data.";
    return "Safe fallback: analyst assistant is provider-ready. Use team form, head-to-head, injuries, odds, and evidence notes manually until OpenAI is configured.";
  }
}
