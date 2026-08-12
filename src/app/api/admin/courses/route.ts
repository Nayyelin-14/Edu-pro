import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createCourseSchema } from "@/lib/validation/course";
import { createCourse, listAdminCourses } from "@/server/services/admin.course.service";
import { requireStaff, requireSuperAdmin, requireUser } from "@/server/guards";
import { coursesQuerySchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return run(async () => {
    await requireStaff(await requireUser());
    const sp = req.nextUrl.searchParams;
    const query = coursesQuerySchema.parse({
      search: sp.get("search") || undefined,
      status: sp.get("status") || "ALL",
      categoryId: sp.get("categoryId") || undefined,
      page: sp.get("page") || 1,
      pageSize: sp.get("pageSize") || 20,
    });
    return ok(await listAdminCourses(query));
  });
}

export async function POST(req: NextRequest) {
  return run(async () => {
    await requireSuperAdmin(await requireUser());
    const input = createCourseSchema.parse(await parseBody(req));
    return ok(await createCourse(input), { status: 201 });
  });
}
