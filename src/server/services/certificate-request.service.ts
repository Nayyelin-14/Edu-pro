import { prisma } from "@/lib/prisma";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { bestEffort } from "@/lib/async";
import { notify } from "./notification.service";
import {
  issueCertificateForTestPassInTenant,
  issueCertificateManualInTenant,
} from "./certificate.service";
import type { TenantContext } from "@/server/tenant-context";

export async function requestCertificate(
  ctx: TenantContext,
  courseId: string,
  testResultId?: string,
) {
  const userId = ctx.user.id;
  // Tenant-scoped course lookup: cross-tenant ids resolve as "not found".
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId: ctx.tenant.id },
  });
  if (!course) throw notFound("Course not found");

  const existingCert = await prisma.certificate.findFirst({
    where: { userId, courseId, tenantId: ctx.tenant.id },
  });
  if (existingCert)
    throw conflict("You already have a certificate for this course.");

  const existing = await prisma.certificateRequest.findFirst({
    where: { userId, courseId },
    orderBy: { createdAt: "desc" },
  });
  if (existing?.status === "PENDING")
    throw conflict("Your certificate request is already pending review.");
  if (existing?.status === "APPROVED")
    throw conflict("This certificate request has already been approved.");

  let linkedResultId: string | null = null;
  if (testResultId) {
    const result = await prisma.testResult.findFirst({
      where: { id: testResultId, userId, tenantId: ctx.tenant.id },
    });
    if (!result || !result.passed)
      throw forbidden("You must pass the final test before requesting a certificate.");
    linkedResultId = result.id;
  } else {
    const testIds = await prisma.test.findMany({
      where: { courseId: course.id, tenantId: ctx.tenant.id },
      select: { id: true },
    });
    const passed = await prisma.testResult.findFirst({
      where: {
        userId,
        tenantId: ctx.tenant.id,
        testId: { in: testIds.map((t) => t.id) },
        passed: true,
      },
      orderBy: { submittedAt: "desc" },
    });
    if (!passed)
      throw forbidden("You must pass the final test before requesting a certificate.");
    linkedResultId = passed.id;
  }

  const request = await prisma.certificateRequest.upsert({
    where: { id: existing?.id ?? "" },
    create: {
      userId,
      courseId,
      testResultId: linkedResultId,
      status: "PENDING",
    },
    update: {
      testResultId: linkedResultId,
      status: "PENDING",
      note: null,
      decidedAt: null,
      decidedById: null,
    },
  });

  // Notify the course instructor that a student is requesting a certificate.
  if (course.instructorId) {
    const [instructor, student] = await Promise.all([
      prisma.user.findUnique({ where: { id: course.instructorId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      }),
    ]);
    if (instructor) {
      await bestEffort(
        "notification.certificate_requested",
        notify({
          userId: instructor.id,
          type: "CERTIFICATE_REQUESTED",
          title: `Certificate requested for "${course.title}"`,
          body: `${student?.username ?? "A student"} passed the final test and requested a certificate.`,
          link: `/staff/certificate-requests?focus=${request.id}`,
          actorId: userId,
          courseId: course.id,
        }),
      );
    }
  }

  return request;
}

export async function getMyCertificateRequests(ctx: TenantContext) {
  return prisma.certificateRequest.findMany({
    // TENANT MODE: scope via the course's tenant (CertificateRequest itself
    // is not tenant-owned; the course it points at is).
    where: { userId: ctx.user.id, course: { tenantId: ctx.tenant.id } },
    include: {
      course: { select: { id: true, title: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listCertificateRequests(
  scope: {
    /** TENANT MODE: both fields set. PLATFORM MODE (SUPERADMIN): omit tenantId. */
    tenantId?: string;
    userId: string;
  },
  status?: "PENDING" | "APPROVED" | "REJECTED",
) {
  const include = {
    user: { select: { id: true, username: true, email: true, avatar: true } },
    course: {
      select: {
        id: true,
        title: true,
        slug: true,
        instructorId: true,
      },
    },
    testResult: {
      select: {
        id: true,
        score: true,
        total: true,
        percent: true,
        passed: true,
        submittedAt: true,
        timeTakenSeconds: true,
      },
    },
  } as const;

  // TENANT MODE: own courses inside the active tenant only.
  // PLATFORM MODE (scope.tenantId omitted): SUPERADMIN sees everything.
  const courses = await prisma.course.findMany({
    where: {
      ...(scope.tenantId
        ? { tenantId: scope.tenantId, instructorId: scope.userId }
        : {}),
    },
    select: { id: true },
  });
  const courseIds = courses.map((c) => c.id);
  if (courseIds.length === 0) return [];
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: { in: courseIds } },
    select: { userId: true, courseId: true },
  });
  const enrolledKeys = new Set(
    enrollments.map((e) => `${e.userId}:${e.courseId}`),
  );
  const requests = await prisma.certificateRequest.findMany({
    where: { courseId: { in: courseIds }, ...(status ? { status } : {}) },
    include,
    orderBy: { createdAt: "desc" },
  });
  return requests.filter(
    (r) => enrolledKeys.has(`${r.userId}:${r.courseId}`),
  );
}

/**
 * Decide a certificate request.
 *   TENANT MODE (`scope.tenantId` set): the request's course must live in the
 *   caller's active tenant AND be owned by the caller.
 *   PLATFORM MODE (scope omitted): caller is the SUPERADMIN — full authority.
 */
export async function decideCertificateRequest(
  actorId: string,
  requestId: string,
  action: "APPROVE" | "REJECT",
  scope?: { tenantId: string },
) {
  const instructorId = actorId;
  const request = await prisma.certificateRequest.findFirst({
    where: {
      id: requestId,
      ...(scope ? { course: { tenantId: scope.tenantId, instructorId } } : {}),
    },
    include: {
      course: { select: { id: true, instructorId: true, title: true, tenantId: true } },
    },
  });
  if (!request) throw notFound("Certificate request not found");
  if (request.status !== "PENDING")
    throw conflict("This request has already been decided.");

  if (action === "APPROVE") {
    // Certificate tenant derives authoritatively from the course row.
    const certificate = request.testResultId
      ? await issueCertificateForTestPassInTenant(
          request.userId,
          request.course.id,
          request.course.tenantId,
          request.testResultId,
        )
      : await issueCertificateManualInTenant(
          request.userId,
          request.course.id,
          request.course.tenantId,
        );
    await prisma.certificateRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        decidedAt: new Date(),
        decidedById: instructorId,
      },
    });
    return { request, certificate };
  }

  const decided = await prisma.certificateRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedById: instructorId,
    },
  });

  await bestEffort(
    "notification.certificate_rejected",
    notify({
      userId: request.userId,
      type: "CERTIFICATE_REJECTED",
      title: `Certificate request declined`,
      body: `Your certificate request for "${request.course.title}" was declined by the instructor.`,
      link: "/certificates",
      actorId: instructorId,
      courseId: request.courseId,
    }),
  );

  return { request: decided, certificate: null };
}