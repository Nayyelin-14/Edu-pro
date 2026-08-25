import { notFound } from "next/navigation";
import { requireUserRedirect } from "@/server/guards";
import { resolveTenantContext } from "@/server/tenant-context";
import { prisma } from "@/lib/prisma";
import { CertificateRequestClient } from "@/components/learning/certificate-request-client";

export default async function RequestCertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ testResultId?: string }>;
}) {
  const { courseId } = await params;
  const sp = await searchParams;
  const user = await requireUserRedirect(`/learning/${courseId}/certificate/request`);
  const ctx = await resolveTenantContext(user);

  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId: ctx.tenant.id },
    select: { id: true, title: true, slug: true },
  });
  if (!course) notFound();

  const lastResult = await prisma.testResult.findFirst({
    where: {
      userId: user.id,
      tenantId: ctx.tenant.id,
      test: { courseId: course.id, tenantId: ctx.tenant.id },
    },
    orderBy: { submittedAt: "desc" },
    select: { id: true, passed: true, score: true, total: true, percent: true },
  });

  const existing = await prisma.certificateRequest.findFirst({
    where: { userId: user.id, courseId: course.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true },
  });

  return (
    <div className="container py-10">
      <CertificateRequestClient
        courseId={course.id}
        courseTitle={course.title}
        hasPassed={lastResult?.passed ?? false}
        score={lastResult?.score ?? null}
        total={lastResult?.total ?? null}
        percent={lastResult?.percent ?? null}
        testResultId={sp.testResultId ?? lastResult?.id ?? null}
        existing={existing}
      />
    </div>
  );
}
