import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { setCoursePublished } from "@/server/services/admin.course.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    await requireStaff(await requireUser());
    const { id } = await params;
    return ok(await setCoursePublished(id, true));
  });
}
