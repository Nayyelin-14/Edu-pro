import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { ApiError, notFound } from "@/lib/errors";
import { roadmapReadRepo } from "@/server/services/roadmap.read.service";
import { renderGenerationResult, startRoadmapGeneration } from "@/server/services/roadmap.generate";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Refinement changes the level/hours/duration of an existing saved path and
// regenerates it from the SAME goal (a new generation job -> new roadmap).
const refineSchema = z
  .object({
    level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
    durationWeeks: z.number().int().min(1).max(52).optional(),
    hoursPerWeek: z.number().int().min(1).max(40).optional(),
  })
  .refine((v) => v.level || v.durationWeeks || v.hoursPerWeek, {
    message: "Provide at least one refinement (level, durationWeeks or hoursPerWeek)",
  });

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save") }),
  z.object({ action: z.literal("discard") }),
  z.object({ action: z.literal("refine"), refinements: refineSchema }),
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    const ctx = await requireTenantContext();
    const roadmap = await roadmapReadRepo.getMyRoadmap(ctx.user.id, id, ctx.tenant.id);
    if (!roadmap) {
      // 404 instead of 403 to avoid leaking existence
      throw notFound();
    }
    return ok({ roadmap });
  });
}

/**
 * PATCH /api/roadmaps/[id]
 *   { action: "save" }        -> commit a draft (saved=true, SAVED status)
 *   { action: "discard" }     -> delete a draft (only allowed when not saved)
 *   { action: "refine", refinements } -> regenerate from the same goal with
 *                                       new level / duration / hours
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireUser();
    const { id } = await params;
    const ctx = await requireTenantContext();
    const roadmap = await roadmapReadRepo.getMyRoadmap(ctx.user.id, id, ctx.tenant.id);
    if (!roadmap) throw notFound();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "Invalid JSON body");
    }
    const parsed = patchSchema.parse(body);

    if (parsed.action === "save") {
      const saved = await roadmapReadRepo.saveMyRoadmap(user.id, id, ctx.tenant.id);
      return ok({ roadmap: saved });
    }

    if (parsed.action === "discard") {
      if (roadmap.saved) {
        throw new ApiError(409, "A saved roadmap cannot be discarded; delete it instead.");
      }
      const deleted = await roadmapReadRepo.deleteMyRoadmap(user.id, id, ctx.tenant.id);
      if (!deleted) throw notFound();
      return ok({ success: true });
    }

    // refine
    const input = {
      goal: roadmap.goal,
      level: parsed.refinements.level ?? (roadmap.level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED"),
      durationWeeks: parsed.refinements.durationWeeks ?? roadmap.durationWeeks,
      hoursPerWeek: parsed.refinements.hoursPerWeek ?? roadmap.hoursPerWeek,
      language: (roadmap.language === "th" ? "th" : "en") as "en" | "th",
    };
    const ctx3 = await requireTenantContext();
    const result = await startRoadmapGeneration(ctx.user.id, input, ctx.tenant.id);
    return renderGenerationResult(result);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { id } = await params;
    const deleted = await roadmapReadRepo.deleteMyRoadmap(
      ctx.user.id,
      id,
      ctx.tenant.id,
    );
    if (!deleted) {
      throw notFound();
    }
    return ok({ success: true });
  });
}