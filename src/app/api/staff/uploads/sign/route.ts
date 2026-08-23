import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { signUploadSchema } from "@/lib/validation/upload";
import { signUpload, scheduleSweep } from "@/server/services/upload.service";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import { requireTenantCapability } from "@/server/authorization";

export const dynamic = "force-dynamic";

/**
 * Issues signed DIRECT-upload credentials for lesson media (spec §6).
 *
 * The browser uploads straight to Cloudinary using these parameters — file
 * bytes never pass through this server. Authorization chain:
 *   authenticated staff -> active tenant membership + "author" capability ->
 *   lesson ownership via assertLessonOwner -> kind matches persisted type.
 *
 * Tenant context is REQUIRED even for SUPERADMINs: uploads are always
 * tenant-scoped actions and the storage path derives from the trusted context,
 * never from client input.
 */
export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    const ctx = await requireTenantContext();
    requireTenantCapability(ctx, "author");
    const input = signUploadSchema.parse(await parseBody(req));
    const result = await signUpload(user, ctx, input);
    // Zero-config cleanup trigger: at most one caller per day actually runs
    // the sweep (Redis-coordinated); fire-and-forget, never blocks this response.
    scheduleSweep();
    return ok(result, { status: 201 });
  });
}
