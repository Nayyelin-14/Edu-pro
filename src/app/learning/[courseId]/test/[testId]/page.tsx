import { redirect } from "next/navigation";
import { ExamRunner } from "@/components/learning/exam-runner";
import { isEnrolled } from "@/server/services/enrollment.service";
import { resolveTenantContext } from "@/server/tenant-context";
import { requireUserRedirect } from "@/server/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ courseId: string; testId: string }>;
}

export default async function TestPage({ params }: PageProps) {
  const { courseId, testId } = await params;
  const user = await requireUserRedirect(
    `/learning/${courseId}/test/${testId}`,
  );
  const ctx = await resolveTenantContext(user);

  const enrolled = await isEnrolled(user.id, courseId, ctx.tenant.id);
  if (!enrolled) redirect("/");

  const test = await prisma.test.findFirst({
    where: { id: testId, tenantId: ctx.tenant.id },
    select: { id: true, courseId: true },
  });
  if (!test || test.courseId !== courseId) redirect("/");

  return (
    <div className="h-full w-full bg-background">
      {/* Top header with timer */}
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <a
            href={`/learning/${courseId}`}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center rounded-full p-2 hover:bg-accent"
            aria-label="Back to course"
          >
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div className="h-8 w-px bg-border mx-2" />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
              Exam in Progress
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <ExamRunner testId={testId} courseId={courseId} />
      </main>
    </div>
  );
}
