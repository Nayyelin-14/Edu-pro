import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import type { TenantContext } from "@/server/tenant-context";
import { renderCertificatePdf } from "@/lib/pdf";
import { uploadBuffer } from "@/lib/cloudinary";
import { randomCode } from "@/lib/crypto";
import { sendCertificateEmail } from "@/lib/email";
import { bestEffort } from "@/lib/async";
import { notify } from "./notification.service";

/**
 * Tenant-explicit issuance. `tenantId` MUST be derived server-side from the
 * TenantContext or the authoritative course row — never client input.
 */
export async function issueCertificateForTestPassInTenant(
  userId: string,
  courseId: string,
  tenantId: string,
  testResultId: string,
) {
  const existing = await prisma.certificate.findFirst({
    where: { userId, courseId, tenantId },
  });
  if (existing) return existing;
  const certificate = await createCertificate(userId, courseId, tenantId, testResultId);
  await afterIssue(certificate);
  return certificate;
}

export async function issueCertificateManualInTenant(
  userId: string,
  courseId: string,
  tenantId: string,
) {
  const existing = await prisma.certificate.findFirst({
    where: { userId, courseId, tenantId },
  });
  if (existing) return existing;
  const certificate = await createCertificate(userId, courseId, tenantId, null);
  await afterIssue(certificate);
  return certificate;
}

export async function issueCertificateForTestPass(
  ctx: TenantContext,
  courseId: string,
  testResultId: string,
) {
  return issueCertificateForTestPassInTenant(
    ctx.user.id, courseId, ctx.tenant.id, testResultId,
  );
}

export async function issueCertificateManual(
  ctx: TenantContext,
  courseId: string,
) {
  return issueCertificateManualInTenant(ctx.user.id, courseId, ctx.tenant.id);
}

export async function getMyCertificates(ctx: TenantContext) {
  return prisma.certificate.findMany({
    where: { userId: ctx.user.id, tenantId: ctx.tenant.id },
    include: { course: { select: { id: true, title: true, slug: true } } },
    orderBy: { issuedAt: "desc" },
  });
}

/** PLATFORM MODE: full certificate registry across all tenants (superadmin). */
export async function listAllCertificates(input: {
  search?: string;
  page: number;
  pageSize: number;
}) {
  const where = input.search
    ? {
        OR: [
          { user: { username: { contains: input.search, mode: "insensitive" as const } } },
          { user: { email: { contains: input.search, mode: "insensitive" as const } } },
          { course: { title: { contains: input.search, mode: "insensitive" as const } } },
          { certificateNumber: { contains: input.search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.certificate.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, email: true, avatar: true } },
        course: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { issuedAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.certificate.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function checkCertificate(number: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { certificateNumber: number },
    include: {
      course: { select: { title: true } },
      user: { select: { username: true } },
    },
  });
  if (!certificate) return { valid: false };
  return {
    valid: true,
    number: certificate.certificateNumber,
    userName: certificate.user.username,
    courseTitle: certificate.course.title,
    issuedAt: certificate.issuedAt,
  };
}

async function createCertificate(
  userId: string,
  courseId: string,
  tenantId: string,
  testResultId: string | null,
) {
  const [user, course] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    }),
    // Course must exist within the issuing tenant.
    prisma.course.findFirst({
      where: { id: courseId, tenantId },
      select: { id: true, title: true },
    }),
  ]);
  if (!user || !course) throw notFound("User or course not found");

  const number = `DT-${Date.now().toString(36).toUpperCase()}-${randomCode(6).toUpperCase()}`;
  let pdfUrl: string | null = null;
  try {
    const pdf = await renderCertificatePdf({
      number,
      userName: user.username,
      courseTitle: course.title,
      issuedAt: new Date(),
    });
    const { url } = await uploadBuffer(pdf, {
      folder: "certificates",
      resourceType: "raw",
    });
    pdfUrl = url;
  } catch (err) {
    // PDF storage (Cloudinary) is optional — the certificate is still valid
    // and verifiable by number. Log the failure instead of breaking issuance.
    console.error("Certificate PDF upload failed:", err);
  }
  return prisma.certificate.create({
    data: {
      userId,
      courseId,
      tenantId,
      testResultId,
      certificateNumber: number,
      pdfUrl,
    },
  });
}

async function afterIssue(certificate: {
  id: string;
  userId: string;
  courseId: string;
  certificateNumber: string;
}) {
  const [course, user] = await Promise.all([
    prisma.course.findUnique({
      where: { id: certificate.courseId },
      select: { title: true, slug: true },
    }),
    prisma.user.findUnique({
      where: { id: certificate.userId },
      select: { email: true, username: true },
    }),
  ]);
  if (!course || !user) return;
  await bestEffort(
    "notification.certificate_issued",
    notify({
      userId: certificate.userId,
      type: "CERTIFICATE_ISSUED",
      title: `Certificate earned for "${course.title}"`,
      body: `Congratulations, ${user.username}! Your certificate is ready.`,
      link: `/${certificate.userId}/certificates`,
      courseId: certificate.courseId,
    }),
  );
  await bestEffort(
    "email.certificate",
    sendCertificateEmail(
      user.email,
      course.title,
      certificate.certificateNumber,
      `${process.env.APP_URL || "http://localhost:3000"}/certificates/verify?number=${certificate.certificateNumber}`,
    ),
  );
}
