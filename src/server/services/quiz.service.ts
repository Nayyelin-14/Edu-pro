import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { fromJson } from "@/lib/json";
import type { QuestionShape } from "@/types/content";
import type { TenantContext } from "@/server/tenant-context";
import { isEnrolled } from "./enrollment.service";

interface AnswerInput {
  questionId: string;
  selected: number;
}

export async function submitQuiz(
  ctx: TenantContext,
  quizId: string,
  answers: AnswerInput[],
) {
  const userId = ctx.user.id;
  // Tenant-scoped quiz lookup: cross-tenant quiz ids resolve as "not found".
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, tenantId: ctx.tenant.id },
    select: {
      id: true,
      questions: true,
      module: { select: { courseId: true } },
    },
  });
  if (!quiz) throw notFound("Quiz not found");
  const enrolled = await isEnrolled(userId, quiz.module.courseId, ctx.tenant.id);
  if (!enrolled) throw notFound("Enroll in the course first");

  const questions = fromJson<QuestionShape[]>(quiz.questions);
  const byId = new Map(questions.map((q) => [q.id, q]));
  let score = 0;
  for (const answer of answers) {
    const q = byId.get(answer.questionId);
    if (!q) continue;
    if (
      answer.selected >= 0 &&
      answer.selected < q.options.length &&
      answer.selected === q.correctIndex
    ) {
      score += 1;
    }
  }
  const total = questions.length;
  const passed = total > 0 && score >= Math.ceil(total / 2);

  const existing = await prisma.quizResult.findFirst({
    where: { quizId, userId, tenantId: ctx.tenant.id },
  });
  if (existing) {
    await prisma.quizResult.update({
      where: { id: existing.id },
      data: { score, total, passed },
    });
  } else {
    await prisma.quizResult.create({
      data: { quizId, userId, tenantId: ctx.tenant.id, score, total, passed },
    });
  }
  return { score, total, passed };
}

export async function getLatestQuizResult(ctx: TenantContext, quizId: string) {
  return prisma.quizResult.findFirst({
    where: { quizId, userId: ctx.user.id, tenantId: ctx.tenant.id },
  });
}
