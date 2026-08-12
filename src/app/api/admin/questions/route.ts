import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { questionSchema } from "@/lib/validation/course";
import { addQuestion } from "@/server/services/admin.content.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await requireStaff(await requireUser());
    const body = await parseBody<{
      targetType?: "quiz" | "test";
      targetId?: string;
      question?: unknown;
    }>(req);
    if (!body.targetType || !body.targetId || !body.question) {
      throw badRequest("targetType, targetId and question are required");
    }
    const question = questionSchema.parse(body.question);
    return ok(await addQuestion({ type: body.targetType, id: body.targetId }, question), {
      status: 201,
    });
  });
}
