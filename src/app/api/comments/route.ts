import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createCommentSchema } from "@/lib/validation/comment";
import { createComment, listCommentsByLesson } from "@/server/services/comment.service";
import { requireUser, requireVerified } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const ctx = await requireTenantContext();
    await requireVerified(ctx.user);
    await enforceRateLimit(`comments:${ctx.user.id}`);
    const input = createCommentSchema.parse(await parseBody(req));
    return ok(await createComment(ctx, input), { status: 201 });
  });
}

export async function GET(req: NextRequest) {
  return run(async () => {
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) return ok({ comments: [] });
    // TENANT MODE: comments are readable only inside the lesson's tenant.
    const ctx = await requireTenantContext();
    return ok({ comments: await listCommentsByLesson(lessonId, ctx) });
  });
}
