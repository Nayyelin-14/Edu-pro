/**
 * End-to-end roadmap generation flow against a real `next dev` server.
 *
 * Spawns a dev server on port 3101 pointed at the throwaway elearning_test
 * database (no AI_API_KEY / no QStash, so the deterministic mock provider runs
 * through the inline dev path — same pipeline as the worker) and drives the
 * full flow over real HTTP with a manual cookie jar:
 *
 *   register -> login
 *   vague goal -> 200 NEEDS_CLARIFICATION (questions) -> answer -> COMPLETED
 *   concrete role goal -> 200 COMPLETED with roadmap (interpretation ->
 *     retrieval -> planning -> validation -> atomic persistence -> honest
 *     coverage -> "why this course" evidence)
 *   cross-user read of the roadmap id -> 404
 *
 * Run with: npx tsx --test tests/e2e/roadmap.test.ts
 */
import { after, before, test } from "node:test";
import assert from "node:assert";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";
import { provisionFreshTestDatabase } from "../helpers/provision-test-db";
import { prisma as p2 } from "@/lib/prisma";
/** Uses the REAL default tenant — registration provisions memberships there. */
async function fixtureTenantId(): Promise<string> {
  const t = await p2.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Tenant", slug: "default" },
  });
  return t.id;
}

process.env.DATABASE_URL = getTestDatabaseUrl();

const BASE = "http://127.0.0.1:3101";
const PORT = 3101;

let server: ChildProcess | null = null;
const jar = new Map<string, string>();

function cookieHeader(path: string): string {
  const names: string[] = [];
  if (path.startsWith("/api/auth")) names.push("refresh_token");
  names.push("access_token");
  return names.filter((n) => jar.has(n)).map((n) => `${n}=${jar.get(n)}`).join("; ");
}

function storeCookies(res: Response): void {
  for (const sc of res.headers.getSetCookie()) {
    const pair = sc.split(";")[0];
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function api(
  path: string,
  opts: { method?: string; json?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(opts.json !== undefined ? { "content-type": "application/json" } : {}),
  };
  const cookie = cookieHeader(path);
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });
  storeCookies(res);
  return res;
}

async function waitForReady(): Promise<void> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(10_000) });
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error("Dev server did not become ready in time");
}

let seq = 0;

async function registerAndLogin(prefix: string): Promise<void> {
  seq += 1;
  const email = `e2e-${prefix}-${Date.now()}-${seq}@example.com`;
  const username = `${prefix}${Date.now()}${seq}`;
  const reg = await api("/api/auth/register", {
    method: "POST",
    json: { username, email, password: "password123" },
  });
  assert.strictEqual(reg.status, 201);
  const login = await api("/api/auth/login", {
    method: "POST",
    json: { username: email, password: "password123" },
  });
  assert.strictEqual(login.status, 200);
  assert.ok(jar.has("access_token"));
}

async function seedBackendCatalog(): Promise<void> {
  const now = Date.now();
  const category = await prisma.category.create({
    data: { name: `E2E Cat ${now}`, slug: `e2e-cat-${now}` },
  });
  await prisma.course.create({
    data: {
      slug: `e2e-node-${now}`,
      title: "Node.js Backend Mastery",
      price: 0,
      categoryId: category.id,
      isPublished: true,
      tenantId: await fixtureTenantId(),
      difficulty: "BEGINNER",
      estimatedHours: 20,
      skills: ["backend", "node", "api"],
    },
  });
  await prisma.course.create({
    data: {
      slug: `e2e-db-${now}`,
      title: "SQL Database Design",
      price: 0,
      categoryId: category.id,
      isPublished: true,
      tenantId: await fixtureTenantId(),
      difficulty: "BEGINNER",
      estimatedHours: 15,
      skills: ["database", "sql"],
    },
  });
  await prisma.course.create({
    data: {
      slug: `e2e-front-${now}`,
      title: "React Builds",
      price: 0,
      categoryId: category.id,
      isPublished: true,
      tenantId: await fixtureTenantId(),
      difficulty: "BEGINNER",
      estimatedHours: 12,
      skills: ["react", "javascript"],
    },
  });
}

interface RoadmapPayload {
  status: string;
  jobId?: string;
  roadmap?: {
    id: string;
    goal: string;
    interpretation?: { requiredSkills?: string[] };
    goalCoverage?: number;
    courseAvailability?: number;
    roadmapQuality?: string;
    items?: Array<{
      courseId?: string | null;
      title: string;
      matchedCompetencies?: string[];
    }>;
  };
  questions?: Array<{ id: string; question: string }>;
  interpretation?: { goal?: string; role?: string };
}

before(async () => {
  await provisionFreshTestDatabase();
  const bin = join(process.cwd(), "node_modules", ".bin", "next");
  server = spawn(bin, ["dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    env: {
      ...process.env,
      DATABASE_URL: getTestDatabaseUrl(),
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      RESEND_API_KEY: "",
      AI_API_KEY: "",
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  await waitForReady();
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
  }
});

test("vague goal -> NEEDS_CLARIFICATION -> answers -> COMPLETED roadmap", async () => {
  await registerAndLogin("clarify");
  await seedBackendCatalog();

  const vague = await api("/api/ai/roadmap", {
    method: "POST",
    json: { goal: "I want to learn new things this year" },
  });
  assert.strictEqual(vague.status, 200, "clarification is a 200, not an error");
  const vagueBody = (await vague.json()) as { data: RoadmapPayload };
  assert.strictEqual(vagueBody.data.status, "NEEDS_CLARIFICATION");
  assert.ok(vagueBody.data.questions && vagueBody.data.questions.length > 0, "clarification questions returned");
  assert.ok(vagueBody.data.interpretation, "the server previews its interpretation");

  const answered = await api("/api/ai/roadmap", {
    method: "POST",
    json: {
      goal: "I want to learn new things this year",
      answers: [
        { id: "role", value: "backend developer" },
        { id: "skills", value: "database, API" },
      ],
    },
  });
  assert.strictEqual(answered.status, 200);
  const answeredBody = (await answered.json()) as { data: RoadmapPayload };
  if (answeredBody.data.status === "NEEDS_CLARIFICATION") {
    // The answers must merge deterministically, so this is not expected — but
    // fail loudly rather than silently pass if the contract drifts.
    throw new Error("answers were not accepted: still NEEDS_CLARIFICATION");
  }
  assert.strictEqual(answeredBody.data.status, "COMPLETED", "inline dev path completes synchronously");
  const roadmap = answeredBody.data.roadmap;
  assert.ok(roadmap?.id, "a roadmap is returned");
  assert.ok(roadmap.items && roadmap.items.length > 0, "the roadmap has stages");
  const courseItems = roadmap.items.filter((i) => i.courseId);
  assert.ok(courseItems.length > 0, "stages resolve to real catalog courses");
  assert.ok(roadmap.goalCoverage !== undefined && roadmap.courseAvailability !== undefined, "honest coverage is reported");
});

test("concrete role goal -> COMPLETED roadmap with honest coverage and why-this-course evidence", async () => {
  await registerAndLogin("concrete");
  await seedBackendCatalog();

  const res = await api("/api/ai/roadmap", {
    method: "POST",
    json: { goal: "Become a backend developer" },
  });
  assert.strictEqual(res.status, 200);
  const body = (await res.json()) as { data: RoadmapPayload };
  assert.strictEqual(body.data.status, "COMPLETED");
  const roadmap = body.data.roadmap;
  assert.ok(roadmap?.id, "roadmap id present");
  assert.ok(roadmap.interpretation?.requiredSkills?.length, "interpretation persisted");
  assert.ok(roadmap.goalCoverage! >= 0 && roadmap.goalCoverage! <= 100, "goal coverage 0..100");
  assert.ok(roadmap.courseAvailability! >= 0 && roadmap.courseAvailability! <= 100, "course availability 0..100");
  assert.ok(["excellent", "good", "partial", "poor"].includes(roadmap.roadmapQuality ?? ""), "roadmap quality label");

  // The "why this course?" evidence must be server-computed and persisted.
  const detailRes = await api(`/api/roadmaps/${roadmap.id}`);
  assert.strictEqual(detailRes.status, 200);
  const detailBody = (await detailRes.json()) as { data: { roadmap: RoadmapPayload["roadmap"] } };
  const detail = detailBody.data.roadmap!;
  const courseItems = detail.items?.filter((i) => i.courseId) ?? [];
  assert.ok(courseItems.length > 0, "at least one real course in the path");
  for (const item of courseItems) {
    assert.ok(Array.isArray(item.matchedCompetencies) && item.matchedCompetencies.length > 0, `"why this course" evidence for ${item.title}`);
  }
  assert.ok(courseItems.some((i) => i.matchedCompetencies!.includes("database")), "backend skills mapped to courses");
});

test("the same fingerprint idempotently returns the completed roadmap (no new generation)", async () => {
  await registerAndLogin("idempotent");
  await seedBackendCatalog();

  const first = await api("/api/ai/roadmap", {
    method: "POST",
    json: { goal: "Become a backend developer" },
  });
  const firstBody = (await first.json()) as { data: RoadmapPayload };
  assert.strictEqual(firstBody.data.status, "COMPLETED");

  const second = await api("/api/ai/roadmap", {
    method: "POST",
    json: { goal: "Become a backend developer" },
  });
  const secondBody = (await second.json()) as { data: RoadmapPayload };
  assert.strictEqual(secondBody.data.status, "COMPLETED");
  assert.strictEqual(secondBody.data.roadmap?.id, firstBody.data.roadmap?.id, "same fingerprint returns the same roadmap");
  assert.strictEqual(await prisma.roadmap.count({ where: { userId: (await api("/api/me").then((r) => r.json()) as { data: { user: { id: string } } }).data.user.id } }), 1, "no duplicate roadmap for the same request");
});

test("cross-user roadmap read returns 404 (no IDOR leak)", async () => {
  await registerAndLogin("owner");
  await seedBackendCatalog();
  const made = await api("/api/ai/roadmap", {
    method: "POST",
    json: { goal: "Become a backend developer" },
  });
  const madeBody = (await made.json()) as { data: RoadmapPayload };
  const roadmapId = madeBody.data.roadmap!.id;

  await registerAndLogin("intruder");
  const stolen = await api(`/api/roadmaps/${roadmapId}`);
  assert.strictEqual(stolen.status, 404, "another user cannot read the roadmap by id");
});