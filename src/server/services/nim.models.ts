/**
 * NVIDIA NIM model discovery + benchmark + ranking.
 *
 * Pipeline:
 *   1. listNimModels()        -> GET /v1/models (OpenAI-compatible)
 *   2. probeModel(id)         -> minimal completion; keeps only models that
 *                                answer a normal chat completion (free tier).
 *   3. benchmarkModel(id)     -> a fixed, small roadmap-planning task; records
 *                                latency + token usage and scores JSON quality
 *                                against the real server-side schema.
 *   4. rankModels()           -> combined score = quality · speed · tokens.
 *                                Top 5 get the `recommended` badge.
 *
 * Results are persisted to src/server/data/nim-models.json so the UI dropdown
 * and the default model can be served without re-running the (slow) bench.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NimProvider, NIM_DEFAULT_BASE_URL, nimModelsUrl } from "@/lib/ai/nim";
import { aiRoadmapPlanSchema } from "@/lib/validation/roadmap";

const DATA_FILE = join(process.cwd(), "src/server/data/nim-models.json");

export interface NimModelInfo {
  id: string;
  displayName: string;
  working: boolean;
  avgLatencyMs: number;
  avgTokens: number;
  qualityScore: number;
  score: number;
  recommended: boolean;
  testedAt: string;
  error?: string;
}

const PROBE_PROMPT = "Reply with strict JSON only: {\"ok\": true}";

const BENCH_GOAL = "i want to become a data analyst";
const BENCH_CANDIDATES = [
  { key: "cand-1", title: "Python Programming Basics", skills: ["python", "programming"], prerequisites: [], difficulty: "BEGINNER", category: "technology", price: 599 },
  { key: "cand-2", title: "Data Analysis with Python", skills: ["data-analysis", "pandas", "visualization", "statistics"], prerequisites: ["python"], difficulty: "INTERMEDIATE", category: "technology", price: 999 },
];

function apiKey(): string {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI_API_KEY is not configured");
  return key;
}

function baseURL(): string {
  return process.env.AI_BASE_URL ?? NIM_DEFAULT_BASE_URL;
}

function displayName(id: string): string {
  return id;
}

/** OpenAI-compatible chat completion with an AbortController timeout. */
async function chat(
  model: string,
  content: string,
  opts: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<{ status: number; latencyMs: number; content?: string; promptTokens?: number; completionTokens?: number }> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(baseURL(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        temperature: 0.2,
        max_tokens: opts.maxTokens ?? 512,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - t0);
    if (!res.ok) {
      return { status: res.status, latencyMs };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      status: res.status,
      latencyMs,
      content: data.choices?.[0]?.message?.content,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    };
  } catch (err) {
    return { status: 0, latencyMs: Math.round(performance.now() - t0), content: String(err) };
  } finally {
    clearTimeout(id);
  }
}

/** Phase 1: quick availability probe. Keeps only models that complete. */
export async function probeModel(model: string): Promise<{ ok: boolean; latencyMs: number; tokens: number; error?: string } | null> {
  const res = await chat(model, PROBE_PROMPT, { maxTokens: 64, timeoutMs: 45_000 });
  if (res.status === 200 && res.content) {
    return { ok: true, latencyMs: res.latencyMs, tokens: (res.promptTokens ?? 0) + (res.completionTokens ?? 0) };
  }
  return null;
}

/** Phase 2: fixed planning task scored against the real schema. */
export async function benchmarkModel(model: string): Promise<{
  ok: boolean;
  latencyMs: number;
  tokens: number;
  qualityScore: number;
  error?: string;
}> {
  const prompt = `You are EduPro's learning-path planner. Return STRICT JSON only with no prose.

User goal: "${BENCH_GOAL}"
Schedule: 12 weeks, 8 hours/week.

EduPro catalog (refer to each course ONLY by its key):
- key: cand-1 | title: "Python Programming Basics" | skills: python, programming | prerequisites: none | difficulty: BEGINNER
- key: cand-2 | title: "Data Analysis with Python" | skills: data-analysis, pandas, visualization, statistics | prerequisites: python | difficulty: INTERMEDIATE

Output a top-level object with exactly: "title", "summary", "stages". Stages: stageNumber, title, description, goal, weekStart, weekEnd, courseKey (an EXACT catalog key or null), reason, isTopic, skills (array), milestones (array). Prerequisites must come before the course that needs them. Max 8 stages.`;

  const res = await chat(model, prompt, { maxTokens: 1024, timeoutMs: 60_000 });
  if (res.status !== 200 || !res.content) {
    return { ok: false, latencyMs: res.latencyMs, tokens: 0, qualityScore: 0, error: `status ${res.status}` };
  }
  const tokens = (res.promptTokens ?? 0) + (res.completionTokens ?? 0);
  const quality = scorePlan(res.content);
  return { ok: true, latencyMs: res.latencyMs, tokens, qualityScore: quality };
}

/** Deterministic quality score (0..1) for a model's JSON plan. */
export function scorePlan(raw: string): number {
  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^\s*(?:```[a-zA-Z0-9-]*\s*)?/, "").replace(/\s*(?:```)?\s*$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return 0;
  }
  const check = aiRoadmapPlanSchema.safeParse(parsed);
  if (!check.success) return 0.1;
  const stages = check.data.stages;
  const keys = new Set(BENCH_CANDIDATES.map((c) => c.key));
  const courseStages = stages.filter((s) => s.courseKey !== null);
  const validKeys = courseStages.filter((s) => keys.has(s.courseKey as string)).length;
  const hasSummary = (check.data.summary ?? "").length > 0 ? 1 : 0;
  const ordered = stages.every((s, i) => i === 0 || stages[i - 1]!.stageNumber < s.stageNumber) ? 1 : 0;
  const inRange = stages.every(
    (s) => s.weekStart >= 1 && s.weekEnd >= s.weekStart && s.weekEnd <= 12,
  )
    ? 1
    : 0;
  const coverage = courseStages.length > 0 ? validKeys / courseStages.length : 0;

  return Math.min(
    1,
    0.3 * hasSummary +
      0.25 * ordered +
      0.2 * inRange +
      0.15 * coverage +
      0.1 * Math.min(1, stages.length / 4),
  );
}

/** Run the full bench: probe -> benchmark working models (bounded concurrency). */
export async function runNimBenchmark(opts: { concurrency?: number } = {}): Promise<NimModelInfo[]> {
  const concurrency = opts.concurrency ?? 5;
  const models = await listNimModels();

  const results: NimModelInfo[] = [];
  const queue = [...models];
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const model = queue.shift();
      if (!model) return;
      const probed = await probeModel(model);
      if (!probed) {
        results.push({ id: model, displayName: displayName(model), working: false, avgLatencyMs: 0, avgTokens: 0, qualityScore: 0, score: 0, recommended: false, testedAt: new Date().toISOString(), error: "not available on free tier" });
        continue;
      }
      const bench = await benchmarkModel(model);
      results.push({
        id: model,
        displayName: displayName(model),
        working: bench.ok,
        avgLatencyMs: (probed.latencyMs + bench.latencyMs) / 2,
        avgTokens: (probed.tokens + bench.tokens) / 2,
        qualityScore: bench.qualityScore,
        score: 0,
        recommended: false,
        testedAt: new Date().toISOString(),
        error: bench.ok ? undefined : bench.error,
      });
    }
  });
  await Promise.all(workers);

  return rankModels(results);
}

/** Combined score: quality dominates; speed and token-efficiency break ties. */
export function rankModels(results: NimModelInfo[]): NimModelInfo[] {
  const working = results.filter((r) => r.working);
  const maxLatency = Math.max(1, ...working.map((r) => r.avgLatencyMs));
  const maxTokens = Math.max(1, ...working.map((r) => r.avgTokens));

  const ranked = results
    .map((r) => {
      if (!r.working) {
        return { ...r, score: 0, recommended: false };
      }
      const latencyScore = 250 * (1 - r.avgLatencyMs / maxLatency);
      const tokenScore = 250 * (1 - r.avgTokens / maxTokens);
      const score = r.qualityScore * 1000 + latencyScore + tokenScore;
      return { ...r, score: Math.round(score) };
    })
    .sort((a, b) => b.score - a.score);

  const top = new Set(ranked.filter((r) => r.working).slice(0, 5).map((r) => r.id));
  return ranked.map((r) => (top.has(r.id) ? { ...r, recommended: true } : r));
}

/** GET /v1/models -> list of model ids (as-is; filtered later by probing). */
export async function listNimModels(): Promise<string[]> {
  const res = await fetch(nimModelsUrl(baseURL()), {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error(`Failed to list NIM models: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  const ids = (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
  return ids.sort();
}

// --- persistence + cached access -------------------------------------------------

let cache: NimModelInfo[] | null = null;

export function setModelCache(list: NimModelInfo[]): void {
  cache = list;
}

/** Served to the UI. Falls back to the persisted bench results. */
export async function getModelCatalog(): Promise<NimModelInfo[]> {
  if (cache) return cache;
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    cache = JSON.parse(raw) as NimModelInfo[];
  } catch {
    cache = [];
  }
  return cache;
}

export async function saveModelCatalog(list: NimModelInfo[]): Promise<void> {
  cache = list;
  await writeFile(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
}

/** The default model = top-ranked working model, or NIM_MODEL, or the fallback. */
export function defaultNimModel(): string {
  const env = process.env.NIM_MODEL;
  if (env) return env;
  const cached = cache;
  if (cached) {
    const top = cached.find((m) => m.working);
    if (top) return top.id;
  }
  return "meta/llama-3.3-70b-instruct";
}

export { NimProvider };