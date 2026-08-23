import { NextRequest } from "next/server";
import { ok, run } from "@/lib/api";
import { setCourseStatus } from "@/server/services/admin.course.service";
import { requireSuperAdmin, requireUser } from "@/server/guards";
import { notify } from "@/server/services/notification.service";
import { sendCourseApprovedEmail } from "@/lib/email";
import { bestEffort } from "@/lib/async";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Only a superadmin can approve (publish) a course.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(async () => {
    const superadmin = await requireSuperAdmin(await requireUser());
    const { id } = await params;
    const course = await setCourseStatus(id, "APPROVED");
    if (course.instructorId) {
      const instructor = await prisma.user.findUnique({
        where: { id: course.instructorId },
        select: { email: true },
      });
      if (instructor) {
        await bestEffort(
          "notification.course_approved",
          notify({
            userId: course.instructorId,
            type: "COURSE_APPROVED",
            title: `"${course.title}" was approved`,
            body: "Your course is now live on the platform.",
            link: `/staff/courses/${course.id}`,
            actorId: superadmin.id,
            courseId: course.id,
          }),
        );
        await bestEffort(
          "email.course_approved",
          sendCourseApprovedEmail(
            instructor.email,
            course.title,
            `${process.env.APP_URL || "http://localhost:3000"}/courses/${course.slug}`,
          ),
        );
      }
    }
    return ok(course);
  });
}