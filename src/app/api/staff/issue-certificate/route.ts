import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { issueCertificateSchema } from "@/lib/validation/admin";
import { issueCertificateManualInTenant } from "@/server/services/certificate.service";
import { requireSuperAdmin, requireUser } from "@/server/guards";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";

export const dynamic = "force-dynamic";

// PLATFORM MODE: superadmin-issued certificates across tenants. The
// certificate's tenant derives authoritatively from the course row.
export async function POST(req: NextRequest) {
  return run(async () => {
    await requireSuperAdmin(await requireUser());
    const input = issueCertificateSchema.parse(await parseBody(req));
    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
      select: { tenantId: true },
    });
    if (!course) throw notFound("Course not found");
    const certificate = await issueCertificateManualInTenant(
      input.userId,
      input.courseId,
      course.tenantId,
    );
    return ok(
      {
        certificate: {
          id: certificate.id,
          number: certificate.certificateNumber,
          pdfUrl: certificate.pdfUrl,
        },
      },
      { status: 201 },
    );
  });
}
