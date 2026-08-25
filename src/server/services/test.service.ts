import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/errors";
import { fromJson } from "@/lib/json";
import type { QuestionShape } from "@/types/content";
import { toQuestionView } from "@/types/content";
import type { TenantContext } from "@/server/tenant-context";
import { isEnrolled } from "./enrollment.service";
import { getItemProgress } from "./learning.service";

/** Minimum share of a course's items (lessons AND quizzes) that must be
 *  finished before the learner is allowed to attempt (start or submit) the
 *  final exam. */
export const MIN_COURSE_COMPLETION_PERCENT = 85;

async function assertEligibleForTest(ctx: TenantContext, courseId: string) {
  const completion = await getItemProgress(ctx, courseId);
  if (completion.percent < MIN_COURSE_COMPLETION_PERCENT) {
    throw forbidden(
      `Complete at least ${MIN_COURSE_COMPLETION_PERCENT}% of the course (lessons & quizzes) before taking the final exam (you're at ${completion.percent}%).`,
    );
  }
}

interface AnswerInput {
  questionId: string;
  selected: number;
}

export async function startTest(ctx: TenantContext, testId: string) {
  const userId = ctx.user.id;
  // Tenant-scoped test lookup: cross-tenant test ids resolve as "not found".
  const test = await prisma.test.findFirst({
    where: { id: testId, tenantId: ctx.tenant.id },
    include: { course: { select: { id: true, isPublished: true } } },
  });
  if (!test || !test.isEnabled) throw notFound("Test not found");
  if (!test.course.isPublished) throw notFound("Course not found");
  const enrolled = await isEnrolled(userId, test.courseId, ctx.tenant.id);
  if (!enrolled) throw notFound("Enroll in the course first");
  await assertEligibleForTest(ctx, test.courseId);
  await assertAttemptsAvailable(userId, test, ctx.tenant.id);

  const questions = fromJson<QuestionShape[]>(test.questions).map(toQuestionView);
  return {
    test: {
      id: test.id,
      title: test.title,
      description: test.description,
      timeLimitMinutes: test.timeLimitMinutes,
      passingScore: test.passingScore,
      attemptLimit: test.attemptLimit,
      questions,
    },
    startedAt: new Date().toISOString(),
  };
}

export async function getTestStatus(ctx: TenantContext, testId: string) {
  const test = await prisma.test.findFirst({
    where: { id: testId, tenantId: ctx.tenant.id },
    select: {
      id: true,
      title: true,
      attemptLimit: true,
      passingScore: true,
      timeLimitMinutes: true,
    },
  });
  if (!test) throw notFound("Test not found");
  const results = await prisma.testResult.findMany({
    where: { testId, userId: ctx.user.id, tenantId: ctx.tenant.id },
    orderBy: { submittedAt: "desc" },
  });
  return {
    test,
    attemptsUsed: results.length,
    lastResult: results[0] ?? null,
  };
}

export async function submitTest(
  ctx: TenantContext,
  testId: string,
  answers: AnswerInput[],
  startedAt?: string,
) {
  const userId = ctx.user.id;
  const test = await prisma.test.findFirst({ where: { id: testId, tenantId: ctx.tenant.id } });
  if (!test || !test.isEnabled) throw notFound("Test not found");
  const enrolled = await isEnrolled(userId, test.courseId, ctx.tenant.id);
  if (!enrolled) throw notFound("Enroll in the course first");
  await assertEligibleForTest(ctx, test.courseId);
  await assertAttemptsAvailable(userId, test, ctx.tenant.id);

  const questions = fromJson<QuestionShape[]>(test.questions);
  const byId = new Map(questions.map((q) => [q.id, q]));
  let score = 0;
  const snapshot = answers.map((answer) => {
    const q = byId.get(answer.questionId);
    const correct =
      q !== undefined &&
      answer.selected >= 0 &&
      answer.selected < q.options.length &&
      answer.selected === q.correctIndex;
    if (correct) score += 1;
    return {
      questionId: answer.questionId,
      selected: answer.selected,
      correct,
    };
  });
  const total = questions.length;
  const percent = total === 0 ? 0 : Math.round((score / total) * 100);
  const passed = percent >= test.passingScore;
  const timeTakenSeconds = startedAt
    ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
    : 0;

  const result = await prisma.testResult.create({
    data: {
      testId,
      userId,
      tenantId: ctx.tenant.id,
      score,
      total,
      percent,
      passed,
      answers: snapshot,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      timeTakenSeconds,
    },
  });

  return {
    result: {
      id: result.id,
      score,
      total,
      percent,
      passed,
      timeTakenSeconds,
    },
    // Certificates are no longer auto-issued. The student must request one and
    // the course instructor decides whether to issue it.
    certificate: null,
    eligible: passed,
  };
}

async function assertAttemptsAvailable(
  userId: string,
  test: { id: string; attemptLimit: number },
  tenantId: string,
): Promise<void> {
  const count = await prisma.testResult.count({ where: { testId: test.id, userId, tenantId } });
  if (count >= test.attemptLimit) {
    throw forbidden("Attempt limit reached for this test");
  }
}
