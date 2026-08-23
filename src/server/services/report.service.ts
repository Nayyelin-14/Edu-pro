import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { ReportStatus } from "@/generated/prisma/enums";
import { bestEffort } from "@/lib/async";
import { notify } from "./notification.service";
import type { TenantContext } from "@/server/tenant-context";

export async function createReport(
  ctx: TenantContext,
  input: { courseId: string; reason: string; details?: string },
) {
  // Tenant-scoped course lookup: cross-tenant ids resolve as "not found".
  const course = await prisma.course.findFirst({
    where: { id: input.courseId, tenantId: ctx.tenant.id },
    select: { id: true },
  });
  if (!course) throw notFound("Course not found");
  return prisma.report.create({
    data: {
      reporterId: ctx.user.id,
      courseId: input.courseId,
      tenantId: ctx.tenant.id,
      reason: input.reason,
      details: input.details || null,
    },
  });
}

export async function getMyReports(ctx: TenantContext) {
  return prisma.report.findMany({
    where: { reporterId: ctx.user.id, tenantId: ctx.tenant.id },
    include: { course: { select: { id: true, title: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listReports(
  input: {
    status?: "ALL" | "PENDING" | "RESOLVED" | "DISMISSED";
    page: number;
    pageSize: number;
  },
  scope: {
    /** TENANT MODE: both fields set. PLATFORM MODE (SUPERADMIN): omit both. */
    tenantId?: string;
    instructorId?: string;
  },
) {
  const where: Prisma.ReportWhereInput = {
    // TENANT MODE: the active tenant is a hard filter.
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    ...(input.status && input.status !== "ALL"
      ? { status: input.status as ReportStatus }
      : {}),
    ...(scope.instructorId ? { course: { instructorId: scope.instructorId } } : {}),
  };
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

/**
 * Resolve a report.
 *   TENANT MODE (`scope.tenantId` set): the report must live in the caller's
 *   active tenant AND the caller must own the reported course.
 *   PLATFORM MODE (scope omitted): caller is the SUPERADMIN — full authority.
 */
export async function resolveReport(
  actorId: string,
  reportId: string,
  status: "RESOLVED" | "DISMISSED",
  scope?: { tenantId: string },
) {
  if (scope) {
    const owned = await prisma.report.findFirst({
      where: {
        id: reportId,
        tenantId: scope.tenantId,
        course: { instructorId: actorId },
      },
      select: { id: true },
    });
    if (!owned) throw notFound("Report not found");
  }
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("Report not found");
  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      status,
      resolvedAt: new Date(),
      resolvedBy: actorId,
    },
  });
  await bestEffort(
    "notification.report_resolved",
    notify({
      userId: report.reporterId,
      type: "REPORT_RESOLVED",
      title:
        status === "RESOLVED"
          ? "Your report has been resolved"
          : "Your report was reviewed",
      body:
        status === "RESOLVED"
          ? "Thank you — the team has acted on your report."
          : "Your report was reviewed and no action was taken.",
      link: `/${report.reporterId}/reports`,
      actorId: actorId,
      courseId: report.courseId,
    }),
  );
  return updated;
}
