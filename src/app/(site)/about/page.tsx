import type { Metadata } from "next";

import { AboutClient } from "@/components/about/about-client";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About EduPro",
  description:
    "Learn about EduPro — our mission, the team behind the platform, and the values that shape every course we build.",
};

export default async function AboutPage() {
  const [totalStudents, publishedCourses, totalCertificates, instructors] =
    await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.course.count({ where: { isPublished: true } }),
      prisma.certificate.count(),
      prisma.user.findMany({
        where: { role: { in: [UserRole.INSTRUCTOR, UserRole.SUPERADMIN] } },
        orderBy: { createdAt: "asc" },
        take: 8,
        select: {
          id: true,
          username: true,
          avatar: true,
          _count: {
            select: {
              instructorCourses: { where: { isPublished: true } },
            },
          },
        },
      }),
    ]);

  return (
    <AboutClient
      counts={{
        students: totalStudents,
        courses: publishedCourses,
        certificates: totalCertificates,
      }}
      team={instructors.map((instructor) => ({
        id: instructor.id,
        username: instructor.username,
        avatar: instructor.avatar,
        courseCount: instructor._count.instructorCourses,
      }))}
    />
  );
}