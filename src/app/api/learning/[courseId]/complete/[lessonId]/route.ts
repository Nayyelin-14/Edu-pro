import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { toggleLessonComplete } from "@/server/services/learning.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> },
) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { lessonId } = await params;
    return ok(await toggleLessonComplete(ctx, lessonId));
  });
}
