import type { Metadata } from "next";

import { HomeClient } from "@/components/home/home-client";
import { prisma } from "@/lib/prisma";

import {
  listPublishedCourses,
  listCategories,
} from "@/server/services/course.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EduPro — Learn, grow, get certified",
  description:
    "EduPro E-Learning Platform: enroll in courses, take quizzes and tests, earn certificates, and grow.",
  openGraph: {
    title: "EduPro — Learn, grow, get certified",
    description:
      "Enroll in courses, take quizzes and tests, earn certificates, and grow with EduPro.",
  },
};

export default async function HomePage() {
  const [featured, categories, totalStudents, totalCourses, totalCertificates] =
    await Promise.all([
      listPublishedCourses({
        sort: "POPULAR",
        page: 1,
        pageSize: 6,
      }),

      listCategories(),

      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.course.count({ where: { isPublished: true } }),
      prisma.certificate.count(),
    ]);

  return (
    <HomeClient
      featured={featured.items.map((course) => ({
        ...course,
        moduleCount: course._count?.modules ?? 0,
      }))}
      categories={categories}
      counts={{
        students: totalStudents,
        courses: totalCourses,
        certificates: totalCertificates,
      }}
    />
  );
}