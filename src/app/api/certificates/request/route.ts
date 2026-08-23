import { NextRequest } from "next/server";
import { ok, parseBody, run } from "@/lib/api";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requestCertificate,
} from "@/server/services/certificate-request.service";
import { requireUser } from "@/server/guards";
import { requireTenantContext } from "@/server/tenant-context";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  courseId: z.string().min(1),
  testResultId: z.string().optional(),
});

// A student who passed the final test requests a certificate. The course
// instructor reviews the request and decides whether to issue it.
export async function POST(req: NextRequest) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const input = requestSchema.parse(await parseBody(req));
    return ok(await requestCertificate(ctx, input.courseId, input.testResultId));
  });
}

// Current request status for a student + course (null if none yet).
export async function GET(req: NextRequest) {
  return run(async () => {
    const ctx = await requireTenantContext();
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    if (!courseId) return ok({ request: null });
    const request = await prisma.certificateRequest.findFirst({
      // TENANT MODE: scope via the course's tenant, matching the service
      // layer (CertificateRequest itself carries no tenantId).
      where: { userId: ctx.user.id, courseId, course: { tenantId: ctx.tenant.id } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        decidedAt: true,
      },
    });
    return ok({ request });
  });
}