import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createQuizSchema } from "@/lib/validation/course";
import { createQuiz } from "@/server/services/admin.content.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await requireStaff(await requireUser());
    const input = createQuizSchema.parse(await parseBody(req));
    return ok(await createQuiz(input), { status: 201 });
  });
}
