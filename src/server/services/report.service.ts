import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { ReportStatus } from "@/generated/prisma/enums";

export async function createReport(
  userId: string,
  input: { courseId: string; reason: string; details?: string },
) {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true },
  });
  if (!course) throw notFound("Course not found");
  return prisma.report.create({
    data: {
      reporterId: userId,
      courseId: input.courseId,
      reason: input.reason,
      details: input.details || null,
    },
  });
}

export async function getMyReports(userId: string) {
  return prisma.report.findMany({
    where: { reporterId: userId },
    include: { course: { select: { id: true, title: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listReports(input: {
  status?: "ALL" | "PENDING" | "RESOLVED" | "DISMISSED";
  page: number;
  pageSize: number;
}) {
  const where =
    input.status && input.status !== "ALL"
      ? { status: input.status as ReportStatus }
      : undefined;
  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        course: { select: { id: true, title: true, slug: true } },
        reporter: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.report.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function resolveReport(
  adminId: string,
  reportId: string,
  status: "RESOLVED" | "DISMISSED",
) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("Report not found");
  return prisma.report.update({
    where: { id: reportId },
    data: {
      status,
      resolvedAt: new Date(),
      resolvedBy: adminId,
    },
  });
}
