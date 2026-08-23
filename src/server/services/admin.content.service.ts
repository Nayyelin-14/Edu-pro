import { randomCode } from "@/lib/crypto";
import { conflict, notFound } from "@/lib/errors";
import { fromJson, toInputJson } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import type { QuestionShape } from "@/types/content";

type Target = { type: "quiz" | "test"; id: string };

function withIds(questions: QuestionShape[]): QuestionShape[] {
  return questions.map((q) => ({ ...q, id: q.id || randomCode(6) }));
}

export async function createQuiz(input: {
  moduleId: string;
  title: string;
  questions?: QuestionShape[];
}) {
  const mod = await prisma.module.findUnique({
    where: { id: input.moduleId },
    select: { id: true, tenantId: true },
  });
  if (!mod) throw notFound("Module not found");
  const existing = await prisma.quiz.count({ where: { moduleId: input.moduleId } });
  if (existing > 0)
    throw conflict("A module can only have one quiz. Delete the existing quiz first.");
  // Quiz tenant derives AUTHORITATIVELY from the parent module row.
  return prisma.quiz.create({
    data: {
      moduleId: input.moduleId,
      tenantId: mod.tenantId,
      title: input.title,
      questions: toInputJson(withIds(input.questions ?? [])),
    },
  });
}

/** TENANT-MODE update: scoped to the caller's active tenant. */
export async function updateQuiz(
  quizId: string,
  input: { title?: string; questions?: QuestionShape[] },
  tenantId: string,
) {
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, tenantId } });
  if (!quiz) throw notFound("Quiz not found");
  return prisma.quiz.update({
    where: { id: quizId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.questions !== undefined
        ? { questions: toInputJson(withIds(input.questions)) }
        : {}),
    },
  });
}

/** TENANT-MODE delete: scoped to the caller's active tenant. */
export async function deleteQuiz(quizId: string, tenantId: string): Promise<void> {
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, tenantId } });
  if (!quiz) throw notFound("Quiz not found");
  await prisma.quiz.delete({ where: { id: quizId } });
}

export async function createTest(input: {
  courseId: string;
  title: string;
  description?: string;
  passingScore: number;
  timeLimitMinutes: number;
  attemptLimit: number;
  isEnabled: boolean;
  questions: QuestionShape[];
}) {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true, tenantId: true },
  });
  if (!course) throw notFound("Course not found");
  // Test tenant derives AUTHORITATIVELY from the parent course row.
  return prisma.test.create({
    data: {
      courseId: input.courseId,
      tenantId: course.tenantId,
      title: input.title,
      description: input.description,
      passingScore: input.passingScore,
      timeLimitMinutes: input.timeLimitMinutes,
      attemptLimit: input.attemptLimit,
      isEnabled: input.isEnabled,
      questions: toInputJson(withIds(input.questions)),
    },
  });
}

export async function updateTest(
  testId: string,
  input: Partial<{
    title: string;
    description: string | null;
    passingScore: number;
    timeLimitMinutes: number;
    attemptLimit: number;
    isEnabled: boolean;
    questions: QuestionShape[];
  }>,
  tenantId: string,
) {
  const test = await prisma.test.findFirst({ where: { id: testId, tenantId } });
  if (!test) throw notFound("Test not found");
  return prisma.test.update({
    where: { id: testId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.passingScore !== undefined ? { passingScore: input.passingScore } : {}),
      ...(input.timeLimitMinutes !== undefined
        ? { timeLimitMinutes: input.timeLimitMinutes }
        : {}),
      ...(input.attemptLimit !== undefined ? { attemptLimit: input.attemptLimit } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.questions !== undefined
        ? { questions: toInputJson(withIds(input.questions)) }
        : {}),
    },
  });
}

/** TENANT-MODE delete: scoped to the caller's active tenant. */
export async function deleteTest(testId: string, tenantId: string): Promise<void> {
  const test = await prisma.test.findFirst({ where: { id: testId, tenantId } });
  if (!test) throw notFound("Test not found");
  await prisma.test.delete({ where: { id: testId } });
}

export async function addQuestion(
  target: Target,
  question: QuestionShape,
  tenantId: string,
) {
  const withId = { ...question, id: question.id || randomCode(6) };
  if (target.type === "quiz") {
    const quiz = await prisma.quiz.findFirst({ where: { id: target.id, tenantId } });
    if (!quiz) throw notFound("Quiz not found");
    const questions = fromJson<QuestionShape[]>(quiz.questions);
    return prisma.quiz.update({
      where: { id: target.id },
      data: { questions: toInputJson([...questions, withId]) },
    });
  }
  const test = await prisma.test.findFirst({ where: { id: target.id, tenantId } });
  if (!test) throw notFound("Test not found");
  const questions = fromJson<QuestionShape[]>(test.questions);
  return prisma.test.update({
    where: { id: target.id },
    data: { questions: toInputJson([...questions, withId]) },
  });
}

export async function deleteQuestion(
  target: Target,
  questionId: string,
  tenantId: string,
) {
  if (target.type === "quiz") {
    const quiz = await prisma.quiz.findFirst({ where: { id: target.id, tenantId } });
    if (!quiz) throw notFound("Quiz not found");
    const questions = fromJson<QuestionShape[]>(quiz.questions).filter(
      (q) => q.id !== questionId,
    );
    return prisma.quiz.update({
      where: { id: target.id },
      data: { questions: toInputJson(questions) },
    });
  }
  const test = await prisma.test.findFirst({ where: { id: target.id, tenantId } });
  if (!test) throw notFound("Test not found");
  const questions = fromJson<QuestionShape[]>(test.questions).filter(
    (q) => q.id !== questionId,
  );
  return prisma.test.update({
    where: { id: target.id },
    data: { questions: toInputJson(questions) },
  });
}
