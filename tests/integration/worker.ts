/**
 * Multi-instance concurrency worker.
 *
 * Each invocation is a separate Node process with its OWN Prisma client and
 * connection pool — simulating a distinct application instance. It fires N
 * concurrent processJob(jobId) deliveries for the same job and records every
 * AI-provider invocation to a shared counter file, so the parent can assert
 * that only ONE AI call happened across ALL instances.
 *
 * Usage: tsx tests/integration/worker.ts <userId> <jobId> <counterFile> <count> <outFile>
 */
import "dotenv/config";
import { appendFileSync, writeFileSync } from "node:fs";
import { createMockProvider } from "@/lib/ai/mock";
import type { PlannerContext } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";
import { NoopRoadmapPublisher } from "@/server/services/roadmap.job-publisher";
import { PrismaRoadmapRepo, RoadmapService } from "@/server/services/roadmap.service";
import { getTestDatabaseUrl } from "../helpers/setup-test-env";

process.env.DATABASE_URL = getTestDatabaseUrl();

const args = process.argv.slice(2);
const userId = args[0];
const jobId = args[1];
const counterFile = args[2];
const count = Number(args[3] ?? "100");
const outFile = args[4];
if (!userId || !jobId || !counterFile || !outFile) {
  throw new Error("Usage: worker.ts <userId> <jobId> <counterFile> <count> <outFile>");
}

const repo = new PrismaRoadmapRepo();
const inner = createMockProvider();
let providerCalls = 0;

const provider = {
  async generateRoadmap(ctx: PlannerContext) {
    providerCalls += 1;
    appendFileSync(counterFile, "ai-call\n");
    // Widen the race window so a second instance could (wrongly) generate too.
    await new Promise((r) => setTimeout(r, 600));
    return inner.generateRoadmap(ctx);
  },
};

const service = new RoadmapService(provider, new NoopRoadmapPublisher());

const results = await Promise.all(
  Array.from({ length: count }, () => service.processJob(jobId, repo)),
);
await prisma.$disconnect();

const ids = results.flatMap((r) => (r.outcome === "completed" ? [r.roadmapId] : []));
writeFileSync(
  outFile,
  JSON.stringify({
    uniqueCount: new Set(ids).size,
    allSame: ids.every((id) => id === ids[0]),
    providerCalls,
    completed: results.filter((r) => r.outcome === "completed").length,
    noops: results.filter((r) => r.outcome === "noop").length,
    count: results.length,
  }),
);