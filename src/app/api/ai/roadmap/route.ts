import { NextRequest } from "next/server";
import { run } from "@/lib/api";
import { ApiError, payloadTooLarge } from "@/lib/errors";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import {
  applyRoadmapDefaults,
  generateRoadmapSchema,
  LOCALE_COOKIE,
  renderGenerationResult,
  startRoadmapGeneration,
} from "@/server/services/roadmap.generate";

export const dynamic = "force-dynamic";

// Keep request bodies small: the schema caps the goal at 500 chars.
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireUser();

    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      throw payloadTooLarge("Request body exceeds 16 KB");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Invalid JSON body");
    }
    const input = applyRoadmapDefaults(
      generateRoadmapSchema.parse(parsed),
      req.cookies.get(LOCALE_COOKIE)?.value ?? null,
    );

    const ctx = await requireTenantContext();
    const result = await startRoadmapGeneration(ctx.user.id, input, ctx.tenant.id);
    return renderGenerationResult(result);
  });
}