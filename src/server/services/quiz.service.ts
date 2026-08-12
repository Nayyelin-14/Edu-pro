import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { fromJson } from "@/lib/json";
import type { QuestionShape } from "@/types/content";
import { isEnrolled } from "./enrollment.service";

interface AnswerInput {
  questionId: string;
  selected: number;
}

export async function submitQuiz(
  userId: string,
  quizId: string,
  answers: AnswerInput[],
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      questions: true,
      module: { select: { courseId: true } },
    },
  });
  if (!quiz) throw notFound("Quiz not found");
  const enrolled = await isEnrolled(userId, quiz.module.courseId);
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

  await prisma.quizResult.upsert({
    where: { quizId_userId: { quizId, userId } },
    update: { score, total, passed },
    create: { quizId, userId, score, total, passed },
  });
  return { score, total, passed };
}

export async function getLatestQuizResult(userId: string, quizId: string) {
  return prisma.quizResult.findUnique({
    where: { quizId_userId: { quizId, userId } },
  });
}
