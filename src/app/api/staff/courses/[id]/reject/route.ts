import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { setCourseStatus } from "@/server/services/admin.course.service";
import { requireSuperAdmin, requireUser } from "@/server/guards";
import { notify } from "@/server/services/notification.service";
import { sendCourseRejectedEmail } from "@/lib/email";
import { bestEffort } from "@/lib/async";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Only a superadmin can reject a submitted course.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const superadmin = await requireSuperAdmin(await requireUser());
    const { id } = await params;
    const course = await setCourseStatus(id, "REJECTED");
    if (course.instructorId) {
      const instructor = await prisma.user.findUnique({
        where: { id: course.instructorId },
        select: { email: true },
      });
      if (instructor) {
        await bestEffort(
          "notification.course_rejected",
          notify({
            userId: course.instructorId,
            type: "COURSE_REJECTED",
            title: `"${course.title}" was not approved`,
            body: "You can review the course and resubmit it for approval.",
            link: `/staff/courses/${course.id}`,
            actorId: superadmin.id,
            courseId: course.id,
          }),
        );
        await bestEffort(
          "email.course_rejected",
          sendCourseRejectedEmail(
            instructor.email,
            course.title,
            `${process.env.APP_URL || "http://localhost:3000"}/admin/courses/${course.id}`,
          ),
        );
      }
    }
    return ok(course);
  });
}