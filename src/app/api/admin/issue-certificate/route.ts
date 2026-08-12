import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { issueCertificateSchema } from "@/lib/validation/admin";
import { issueCertificateManual } from "@/server/services/certificate.service";
import { requireStaff, requireUser } from "@/server/guards";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return run(async () => {
    await requireStaff(await requireUser());
    const input = issueCertificateSchema.parse(await parseBody(req));
    const certificate = await issueCertificateManual(input.userId, input.courseId);
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
