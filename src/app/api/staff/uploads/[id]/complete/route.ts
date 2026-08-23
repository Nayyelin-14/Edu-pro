import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { completeUpload } from "@/server/services/upload.service";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import { requireTenantCapability } from "@/server/authorization";

export const dynamic = "force-dynamic";

/**
 * Finalizes a direct upload (spec §13). Idempotent: duplicate completion
 * requests return the current asset state instead of duplicating anything.
 * The client cannot mark an asset READY — readiness requires provider-side
 * verification (existence + format + size), performed here and by the media
 * worker for videos (UPLOADING -> PROCESSING -> READY).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const ctx = await requireTenantContext();
    requireTenantCapability(ctx, "author");
    const { id } = await params;
    return ok(await completeUpload(ctx, id));
  });
}
