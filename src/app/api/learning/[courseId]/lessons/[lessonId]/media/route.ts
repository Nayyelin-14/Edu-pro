import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { resolveLessonMedia } from "@/server/services/upload.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import { isEnrolled } from "@/server/services/enrollment.service";

export const dynamic = "force-dynamic";

/**
 * Secure media access for students (spec §10/§14).
 *
 * Chain: authenticated user -> active tenant membership -> enrollment in the
 * course -> lesson belongs to course+tenant (checked in the service) ->
 * asset READY -> short-lived signed delivery URL.
 *
 * Private media is never exposed as a permanent URL: every playback/view
 * session requests a fresh signed URL that expires. Cross-tenant ids resolve
 * as "not found" — no existence leaks.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const user = await requireUser();
    const { courseId, lessonId } = await params;

    const enrolled = await isEnrolled(user.id, courseId, ctx.tenant.id);
    if (!enrolled) {
      // Identical response for not-enrolled and not-found: no existence leak.
      return ok({ kind: null, url: null, expiresAt: null });
    }

    const wanted = req.nextUrl.searchParams.get("kind") === "pdf" ? "pdf" : "video";
    const media = await resolveLessonMedia(ctx, courseId, lessonId, wanted);
    if (!media) {
      return ok({ kind: null, url: null, expiresAt: null });
    }
    return ok({
      kind: media.kind,
      url: media.url,
      expiresAt: media.expiresAt ? media.expiresAt.toISOString() : null,
    });
  });
}
