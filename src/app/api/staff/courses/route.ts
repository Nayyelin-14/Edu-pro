import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { createCourseSchema } from "@/lib/validation/course";
import { createCourse, listAdminCourses } from "@/server/services/admin.course.service";
import { isPlatformAdmin } from "@/server/authorization";
import { requireStaff, requireUser } from "@/server/guards";
import { requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";
import { coursesQuerySchema } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    if (isPlatformAdmin(user)) {
      // PLATFORM MODE: SUPERADMIN sees every tenant's courses.
      const query = coursesQuerySchema.parse({
        search: req.nextUrl.searchParams.get("search") || undefined,
        status: req.nextUrl.searchParams.get("status") || "ALL",
        categoryId: req.nextUrl.searchParams.get("categoryId") || undefined,
        page: 1,
        pageSize: 20,
      });
      return ok(await listAdminCourses(query, {}));
    }
    // TENANT MODE: instructors manage their own courses in the active tenant.
    const tctx = await requireTenantContext();
    requireTenantCapability(tctx, "author");
    const sp = req.nextUrl.searchParams;
    const query = coursesQuerySchema.parse({
      search: sp.get("search") || undefined,
      status: sp.get("status") || "ALL",
      categoryId: sp.get("categoryId") || undefined,
      page: sp.get("page") || 1,
      pageSize: sp.get("pageSize") || 20,
    });
    return ok(
      await listAdminCourses(query, {
        tenantId: tctx.tenant.id,
        instructorId: user.id,
      }),
    );
  });
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    const input = createCourseSchema.parse(await parseBody(req));
    const ctx = await requireTenantContext();
    return ok(await createCourse(input, ctx.user.id, ctx.tenant.id), { status: 201 });
  });
}