import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { submitQuizSchema } from "@/lib/validation/learning";
import { submitQuiz, getLatestQuizResult } from "@/server/services/quiz.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const quizId = req.nextUrl.searchParams.get("quizId");
    if (!quizId) throw badRequest("quizId is required");
    const input = submitQuizSchema.parse(await parseBody(req));
    return ok(await submitQuiz(ctx, quizId, input.answers));
  });
}

export async function GET(req: NextRequest) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const quizId = req.nextUrl.searchParams.get("quizId");
    if (!quizId) return ok({ result: null });
    return ok({ result: await getLatestQuizResult(ctx, quizId) });
  });
}
