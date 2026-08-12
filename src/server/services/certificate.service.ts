import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { renderCertificatePdf } from "@/lib/pdf";
import { uploadBuffer } from "@/lib/cloudinary";
import { randomCode } from "@/lib/crypto";

export async function issueCertificateForTestPass(
  userId: string,
  courseId: string,
  testResultId: string,
) {
  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;
  return createCertificate(userId, courseId, testResultId);
}

export async function issueCertificateManual(
  userId: string,
  courseId: string,
) {
  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;
  return createCertificate(userId, courseId, null);
}

export async function getMyCertificates(userId: string) {
  return prisma.certificate.findMany({
    where: { userId },
    include: { course: { select: { id: true, title: true, slug: true } } },
    orderBy: { issuedAt: "desc" },
  });
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
  testResultId: string | null,
) {
  const [user, course] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    }),
    prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    }),
  ]);
  if (!user || !course) throw notFound("User or course not found");

  const number = `DT-${Date.now().toString(36).toUpperCase()}-${randomCode(6).toUpperCase()}`;
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
  return prisma.certificate.create({
    data: {
      userId,
      courseId,
      testResultId,
      certificateNumber: number,
      pdfUrl: url,
    },
  });
}
