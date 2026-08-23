/**
 * NVIDIA NIM implementation of the AIProvider interface.
 *
 * Uses the OpenAI-compatible chat completions endpoint directly (no SDK).
 * The endpoint, key and model are configurable via env:
 *   AI_API_KEY   - server-only API key (Authorization: Bearer)
 *   AI_BASE_URL  - full chat completions URL
 *   NIM_MODEL    - default model override
 *
 * Error mapping (all become ApiError so the API route returns a proper status):
 * - 429                     -> 429 (retried internally, then surfaced)
 * - 4xx (permanent)         -> 400
 * - 5xx / timeout / network -> retried, then 502
 */
import type { AIProvider, AIRoadmapPlan, GenerationUsage, GoalInterpretation, PlannerContext } from "./provider";
import { createMockProvider } from "./mock";
import { parseJsonSafe } from "./safe";
import { buildPrompt, buildSystemInstruction } from "./prompt";
import { interpretationSchema } from "@/lib/validation/roadmap";
import { ApiError, badGateway, tooMany } from "@/lib/errors";

export const NIM_DEFAULT_MODEL = "meta/llama-3.1-8b-instruct";
export const NIM_DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_TOKENS = 4096;
const TEMPERATURE = 0.4;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;

export interface NimConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/** The chat completions URL is the base; the models list lives under /models. */
export function nimModelsUrl(baseURL: string): string {
  const trimmed = baseURL.replace(/\/$/, "");
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed.replace(/\/chat\/completions$/i, "/models");
  }
  return `${trimmed.replace(/\/v\d+$/, "")}/v1/models`;
}

function resolveConfig(config: Partial<NimConfig> = {}): NimConfig {
  const apiKey = config.apiKey ?? process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not configured");
  return {
    apiKey,
    baseURL: config.baseURL ?? process.env.AI_BASE_URL ?? NIM_DEFAULT_BASE_URL,
    model: config.model ?? process.env.NIM_MODEL ?? NIM_DEFAULT_MODEL,
    timeoutMs: config.timeoutMs ?? REQUEST_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? MAX_RETRIES,
  };
}

interface NimChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

/** Rough NIM free-tier list price (USD per 1M tokens). */
const INPUT_PRICE_PER_M = 0.1;
const OUTPUT_PRICE_PER_M = 0.4;

function logUsage(model: string, usage?: NimChatResponse["usage"]): void {
  const promptTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const costUsd =
    (promptTokens / 1_000_000) * INPUT_PRICE_PER_M +
    (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_M;
  console.log(
    JSON.stringify({
      event: "nim.completion",
      model,
      promptTokens,
      outputTokens,
      totalTokens: usage?.total_tokens ?? promptTokens + outputTokens,
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

const INTERPRET_SYSTEM =
  "You are a precise goal-interpretation engine for an online learning platform. " +
  "Read the learner's goal and return ONLY strict JSON matching this shape:\n" +
  `{\n` +
  `  "role": string|null,           // the career/role they want to become, without an article (e.g. "backend developer"), null if unclear\n` +
  `  "roleId": string|null,         // hyphenated lowercase role id, e.g. "backend-developer", null if unclear\n` +
  `  "roleSource": "profile"|"general"|"none",  // "profile" only when the role maps to a known EduPro career profile\n` +
  `  "roleConfidence": number,      // 0..1 how sure the stated role is\n` +
  `  "domain": string|null,         // broad field, e.g. "software", "data", "design", null if unclear\n` +
  `  "domainConfidence": number,    // 0..1\n` +
  `  "skills": string[],            // skills the learner explicitly WANTS TO LEARN (lowercase, e.g. "database", "rest api")\n` +
  `  "knownSkills": string[],       // skills they already stated they KNOW; never recommend re-teaching these\n` +
  `  "level": "BEGINNER"|"INTERMEDIATE"|"ADVANCED",\n` +
  `  "confidence": number,          // 0..1 overall interpretation confidence\n` +
  `  "assumptions": string[]        // short honest notes about what you assumed; empty when nothing is ambiguous\n` +
  `}\n` +
  `Never invent skills the goal does not state. "Become a backend developer" is a role, not a skill. "learn PostgreSQL" is the skill "database".`;

function interpretPrompt(goal: string, language: "en" | "th"): string {
  return `Interpret this learning goal and return the strict JSON object described by the system message.\nGoal: "${goal}"\nResponse language: ${language === "th" ? "Thai (keep role/skill identifiers in English)" : "English"}`;
}

export class NimProvider implements AIProvider {
  private config: NimConfig;

  constructor(config?: Partial<NimConfig>) {
    this.config = resolveConfig(config);
  }

  /** OpenAI-compatible chat completion with retry/backoff + error mapping. */
  private async chatCompletion(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    opts: { responseFormat?: boolean; timeoutMs?: number } = {},
  ): Promise<{ content: string; usage?: NimChatResponse["usage"] }> {
    const { apiKey, model, baseURL, timeoutMs, maxRetries } = this.config;
    const attempts = (maxRetries ?? MAX_RETRIES) + 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await sleep(RETRY_BACKOFF_MS * attempt);

      const body: Record<string, unknown> = {
        model,
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_OUTPUT_TOKENS,
      };
      if (opts.responseFormat !== false) {
        body.response_format = { type: "json_object" };
      }

      let res: Response | null = null;
      try {
        res = await this.postJson(baseURL, apiKey, body, opts.timeoutMs ?? timeoutMs ?? REQUEST_TIMEOUT_MS);
      } catch (err: unknown) {
        if (attempt < attempts - 1) continue;
        throw badGateway(`AI provider unreachable: ${friendlyNetworkError(err)}`);
      }

      if (res.ok) {
        const data = (await res.json().catch(() => null)) as NimChatResponse | null;
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw badGateway("AI provider returned no content");
        return { content, usage: data?.usage };
      }

      const snippet = await res.text().catch(() => "<no body>");
      if (res.status === 429) {
        if (attempt < attempts - 1) continue;
        const retryAfter = res.headers.get("retry-after");
        throw tooMany(`AI provider is rate limited${retryAfter ? ` (retry after ${retryAfter}s)` : ""}`);
      }
      if (res.status >= 400 && res.status < 500) {
        // Some models reject response_format; retry once without it.
        if (opts.responseFormat !== false && /response_format|json_object/i.test(snippet)) {
          opts.responseFormat = false;
          continue;
        }
        throw new ApiError(400, `AI provider rejected the request: ${snippet.slice(0, 200)}`);
      }
      // 5xx: retryable.
      if (attempt < attempts - 1) continue;
      throw badGateway(`AI provider temporarily unavailable (${res.status})`);
    }

    throw badGateway("AI provider request failed");
  }

  async generateRoadmap(ctx: PlannerContext): Promise<AIRoadmapPlan & { usage?: GenerationUsage }> {
    const prompt = buildPrompt(ctx);
    const system = buildSystemInstruction();
    const { model } = this.config;
    const { content, usage } = await this.chatCompletion([
      { role: "system", content: system.parts.map((p) => p.text).join("\n") },
      { role: "user", content: prompt },
    ]);
    logUsage(model, usage);
    const parsed = parseJsonSafe(content) as AIRoadmapPlan;
    return {
      ...parsed,
      usage: {
        provider: "nim",
        model,
        inputTokens: usage?.prompt_tokens ?? null,
        outputTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        usageSource: usage ? "provider_reported" : "unavailable",
      },
    };
  }

  async interpretGoal(input: { goal: string; language: "en" | "th" }): Promise<GoalInterpretation> {
    const { model } = this.config;
    const { content, usage } = await this.chatCompletion([
      { role: "system", content: INTERPRET_SYSTEM },
      { role: "user", content: interpretPrompt(input.goal, input.language) },
    ]);
    logUsage(model, usage);
    const raw = parseJsonSafe(content) as unknown;
    const parsed = interpretationSchema.safeParse(raw);
    if (!parsed.success) {
      throw badGateway("AI interpretation did not pass validation.");
    }
    const v = parsed.data;
    return {
      role: v.role ?? null,
      roleId: v.roleId ?? null,
      roleSource: v.roleSource,
      roleConfidence: v.roleConfidence,
      domain: v.domain ?? null,
      domainConfidence: v.domainConfidence,
      skills: v.skills,
      knownSkills: v.knownSkills,
      level: v.level,
      confidence: v.confidence,
      assumptions: v.assumptions,
      target: v.target ?? null,
      outcome: v.outcome ?? null,
      competencies: v.competencies ?? [],
      ambiguity: v.ambiguity ?? { isAmbiguous: false, gaps: [], reason: null },
    };
  }

  private async postJson(
    url: string,
    apiKey: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(id);
    }
  }
}

// Convenience factory used by the service in production.
export function createDefaultNimProvider(model?: string): AIProvider {
  return new NimProvider(model ? { model } : undefined);
}

// Provider factory for the roadmap flow. Uses NIM when a key is configured and
// otherwise falls back to the deterministic mock provider, so the full flow
// (including the inline dev path) works without an API key.
export function createDefaultProvider(model?: string): AIProvider {
  if (!process.env.AI_API_KEY) return createMockProvider();
  return createDefaultNimProvider(model);
}
