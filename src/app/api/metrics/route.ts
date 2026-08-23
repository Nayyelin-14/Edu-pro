import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  return run(async () => {
    if (process.env.METRICS_ENABLED !== "true") {
      throw notFound("Metrics are not enabled");
    }
    return ok({ metrics: getMetrics() });
  });
}