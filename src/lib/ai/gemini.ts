/**
 * Gemini implementation of the AIProvider interface.
 *
 * Uses the Gemini REST API directly (no SDK) so we stay dependency-free. The
 * model is configurable via GEMINI_MODEL so we are never hard-coded. The API key
 * is read from the server-only `GEMINI_API_KEY` env var, sent via the
 * `x-goog-api-key` header (never in the URL), and is never exposed to the
 * browser.
 *
 * Error mapping (all become ApiError so the API route returns a proper status):
 * - 429                     -> 429 (surfaced to the client, no auto-retry)
 * - 4xx (permanent)         -> 400
 * - 5xx / timeout / network -> retried once, then 502
 */
import type { AIProvider, AIRoadmapPlan, GenerationUsage, PlannerContext } from "./provider";
import { parseJsonSafe } from "./safe";
import { ApiError, badGateway, tooMany } from "@/lib/errors";

const DEFAULT_MODEL = "gemini-2.0-flash";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 4096;
const TEMPERATURE = 0.4;
const MAX_RETRIES = 1;
const RETRY_BACKOFF_MS = 600;

export interface GeminiConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function resolveConfig(config: Partial<GeminiConfig> = {}): GeminiConfig {
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return {
    apiKey,
    model: config.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
    baseURL: config.baseURL ?? process.env.GEMINI_BASE_URL ?? DEFAULT_BASE_URL,
    timeoutMs: config.timeoutMs ?? REQUEST_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? MAX_RETRIES,
  };
}

function buildPrompt(ctx: PlannerContext): string {
  const skillsList = ctx.skills.length ? ctx.skills.join(", ") : "general learning";
  const history = Array.from(ctx.progress.values()).filter((p) => p.completed);
  const historyText = history.length
    ? history
        .map((p) => `  - "${p.courseId}" is COMPLETED`)
        .join("\n")
    : "  (none)";

  const catalogText = ctx.candidates
    .map((c) => {
      const progress = ctx.progress.get(c.id);
      const state = progress
        ? `${progress.percent}% (enrolled)`
        : "not enrolled";
      return `- key: ${c.key} | title: "${c.title}" | category: ${c.category ?? "uncategorized"} | lessons: ${c.lessonCount} | price: ${c.price === 0 ? "free" : c.price} THB | progress: ${state}`;
    })
    .join("\n");

  return `You are a personalized learning roadmap planner for EduPro, an e-learning platform.

Your job: given the user's learning goal and a ranked list of real EduPro courses (never invent courses), organize a coherent, personalized learning sequence. You may also emit suggested topics for which EduPro has no matching course.

User profile:
- Goal: "${ctx.goal}"
- Extracted skills: ${skillsList}
- Current level: ${ctx.level}
- Available duration: ${ctx.durationWeeks} weeks, ${ctx.hoursPerWeek} hours/week
- Language for explanations: ${ctx.language === "th" ? "Thai" : "English"}

User's already-completed courses (do NOT re-recommend these as new stages):
${historyText}

EduPro course catalog (your ONLY source of truth for courses). Refer to each course ONLY by its opaque "key" value — never by its title text. If a stage fits no catalog course, set courseKey to null and mark isTopic true:
${catalogText}

Output rules:
- Produce STRICT JSON only. No prose, no code fences.
- Maximum 8 stages, ordered by stageNumber.
- Each stage: stageNumber (int 1..N), title, description, goal, weekStart, weekEnd, courseKey (an EXACT key from the catalog above, or null), reason, isTopic (boolean).
- weekStart <= weekEnd and within 1..${ctx.durationWeeks}.
- A stage may reference at most ONE course. Prefer completed-prerequisite-aware ordering.
- If you recommend a course the user already completed, that is an error — skip it.
- Never invent courses, keys, IDs, or URLs.
- courseKey must be one of the keys listed in the catalog above exactly, or null.
`;
}

function buildSystemInstruction() {
  return [
    {
      role: "user",
      parts: [
        {
          text:
            "You are EduPro's learning-path planner. Always respond with strict JSON that validates against a schema. " +
            "You only recommend real courses from the supplied catalog and may suggest topics where no course exists. " +
            "You never invent courses, IDs, URLs, or completion status. " +
            "You never output prose outside of JSON.",
        },
      ],
    },
  ];
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/** Rough free-tier list price for gemini-2.0-flash (USD per 1M tokens). */
const INPUT_PRICE_PER_M = 0.1;
const OUTPUT_PRICE_PER_M = 0.4;

function logUsage(model: string, usage?: GeminiResponse["usageMetadata"]): void {
  const promptTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;
  const costUsd = (promptTokens / 1_000_000) * INPUT_PRICE_PER_M + (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_M;
  console.log(
    JSON.stringify({
      event: "gemini.completion",
      model,
      promptTokens,
      outputTokens,
      totalTokens: usage?.totalTokenCount ?? promptTokens + outputTokens,
      costUsd: Number(costUsd.toFixed(6)),
    }),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function friendlyNetworkError(err: unknown): string {
  if (err instanceof Error && err.name === "AbortError") return "AI request timed out";
  return err instanceof Error ? err.message : String(err);
}

export class GeminiProvider implements AIProvider {
  private config: GeminiConfig;

  constructor(config?: Partial<GeminiConfig>) {
    this.config = resolveConfig(config);
  }

  async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan & { usage?: GenerationUsage }> {
    const prompt = buildPrompt(ctx);
    const { apiKey, model, baseURL, timeoutMs, maxRetries } = this.config;
    const url = `${baseURL}/models/${model}:generateContent`;

    const body = {
      system_instruction: buildSystemInstruction(),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    };
    const headers = {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    };

    const attempts = (maxRetries ?? MAX_RETRIES) + 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await sleep(RETRY_BACKOFF_MS * attempt);

      let res: Response | null = null;
      try {
        res = await this.postJson(url, headers, body, timeoutMs ?? REQUEST_TIMEOUT_MS);
      } catch (err: unknown) {
        // Network error / timeout: retryable.
        if (attempt < attempts - 1) continue;
        throw badGateway(`AI provider unreachable: ${friendlyNetworkError(err)}`);
      }

      if (res.ok) {
        const data = (await res.json().catch(() => null)) as GeminiResponse | null;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw badGateway("AI provider returned no content");
        const usage: GenerationUsage = {
          provider: "gemini",
          model: model ?? DEFAULT_MODEL,
          inputTokens: data?.usageMetadata?.promptTokenCount ?? null,
          outputTokens: data?.usageMetadata?.candidatesTokenCount ?? null,
          totalTokens: data?.usageMetadata?.totalTokenCount ?? null,
          usageSource: data?.usageMetadata ? "provider_reported" : "unavailable",
        };
        logUsage(model ?? DEFAULT_MODEL, data?.usageMetadata);
        const parsed = parseJsonSafe(text);
        return { ...(parsed as AIRoadmapPlan), usage };
      }

      const snippet = await res.text().catch(() => "<no body>");
      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        throw tooMany(
          `AI provider is rate limited${retryAfter ? ` (retry after ${retryAfter}s)` : ""}`,
        );
      }
      if (res.status >= 400 && res.status < 500) {
        // Permanent provider-side rejection (bad key, model, quota disabled, etc.).
        throw new ApiError(
          400,
          `AI provider rejected the request: ${snippet.slice(0, 200)}`,
        );
      }
      // 5xx: retryable.
      if (attempt < attempts - 1) continue;
      throw badGateway(`AI provider temporarily unavailable (${res.status})`);
    }

    // Unreachable: the loop always throws.
    throw badGateway("AI provider request failed");
  }

  private async postJson(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(id);
    }
  }
}

// Convenience factory used by the service in production.
export function createDefaultGeminiProvider(): AIProvider {
  return new GeminiProvider();
}