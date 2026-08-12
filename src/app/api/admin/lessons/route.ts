import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createLessonSchema } from "@/lib/validation/course";
import { createLesson } from "@/server/services/admin.course.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await requireStaff(await requireUser());
    const input = createLessonSchema.parse(await parseBody(req));
    return ok(await createLesson(input), { status: 201 });
  });
}
