import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createCommentSchema } from "@/lib/validation/comment";
import { createComment, listCommentsByLesson } from "@/server/services/comment.service";
import { requireUser, requireVerified } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireVerified(await requireUser());
    const input = createCommentSchema.parse(await parseBody(req));
    return ok(await createComment(user.id, input), { status: 201 });
  });
}

export async function GET(req: NextRequest) {
  return run(async () => {
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) return ok({ comments: [] });
    return ok({ comments: await listCommentsByLesson(lessonId) });
  });
}
