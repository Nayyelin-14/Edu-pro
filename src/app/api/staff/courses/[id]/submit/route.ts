import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { setCourseStatus } from "@/server/services/admin.course.service";
import { assertCourseOwner, requireStaff, requireUser } from "@/server/guards";
import { isPlatformAdmin, requireTenantCapability } from "@/server/authorization";
import { requireTenantContext } from "@/server/tenant-context";
import { notify } from "@/server/services/notification.service";
import { bestEffort } from "@/lib/async";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/errors";

export const dynamic = "force-dynamic";

// Owner submits their course for superadmin review.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const user = await requireStaff(await requireUser());
    let tctx;
    if (!isPlatformAdmin(user)) {
      // TENANT MODE: instructors manage their own courses only.
      tctx = await requireTenantContext();
      requireTenantCapability(tctx, "author");
    }
    const { id } = await params;
    const courseRef = await assertCourseOwner(user, id, tctx);
    // Defense-in-depth: probe is scoped to the owned course's tenant.
    const testCount = await prisma.test.count({
      where: { courseId: id, tenantId: courseRef.tenantId },
    });
    if (testCount === 0)
      throw badRequest(
        "Each course must have at least one test before it can be submitted.",
      );
    const course = await setCourseStatus(id, "PENDING_REVIEW", courseRef.tenantId);

    // Notify every superadmin so they can review the course.
    const superAdmins = await prisma.user.findMany({
      where: { role: "SUPERADMIN" },
      select: { id: true },
    });
    await Promise.all(
      superAdmins.map((superadmin) =>
        bestEffort(
          "notification.course_submitted",
          notify({
            userId: superadmin.id,
            type: "COURSE_SUBMITTED",
            title: `"${course.title}" submitted for review`,
            body: `${user.username} submitted a course for approval.`,
            link: `/staff/courses/${course.id}`,
            actorId: user.id,
            courseId: course.id,
          }),
        ),
      ),
    );

    return ok(course);
  });
}