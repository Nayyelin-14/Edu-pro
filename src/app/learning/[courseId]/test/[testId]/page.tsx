import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { ExamRunner } from "@/components/learning/exam-runner";
import { isEnrolled } from "@/server/services/enrollment.service";
import { getItemProgress } from "@/server/services/learning.service";
import { MIN_COURSE_COMPLETION_PERCENT } from "@/server/services/test.service";
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

  // Final exam is only available after most of the course is finished.
  const completion = await getItemProgress(ctx, courseId);
  const locked = completion.percent < MIN_COURSE_COMPLETION_PERCENT;

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
              Final Exam
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 overflow-auto">
        {locked ? (
          <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
            <span className="flex size-16 items-center justify-center rounded-full bg-amber-500/10 ring-4 ring-amber-500/15">
              <Lock className="size-8 text-amber-500" />
            </span>
            <h2 className="text-xl font-bold text-foreground">Final exam locked</h2>
            <p className="text-sm text-muted-foreground">
              You need to finish at least {MIN_COURSE_COMPLETION_PERCENT}% of the
              course (lessons &amp; quizzes) before taking the final exam.
              You&apos;re currently at{" "}
              <span className="font-semibold text-foreground">{completion.percent}%</span>{" "}
              ({completion.completedItems}/{completion.totalItems} items).
            </p>
            <a
              href={`/learning/${courseId}`}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Back to course content
            </a>
          </div>
        ) : (
          <ExamRunner testId={testId} courseId={courseId} />
        )}
      </main>
    </div>
  );
}
