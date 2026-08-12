import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/errors";
import { fromJson } from "@/lib/json";
import type { QuestionShape } from "@/types/content";
import { toQuestionView } from "@/types/content";
import { isEnrolled } from "./enrollment.service";
import { issueCertificateForTestPass } from "./certificate.service";

interface AnswerInput {
  questionId: string;
  selected: number;
}

export async function startTest(userId: string, testId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { course: { select: { id: true, isPublished: true } } },
  });
  if (!test || !test.isEnabled) throw notFound("Test not found");
  if (!test.course.isPublished) throw notFound("Course not found");
  const enrolled = await isEnrolled(userId, test.courseId);
  if (!enrolled) throw notFound("Enroll in the course first");
  await assertAttemptsAvailable(userId, test);

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

export async function getTestStatus(userId: string, testId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { id: true, title: true, attemptLimit: true, passingScore: true },
  });
  if (!test) throw notFound("Test not found");
  const results = await prisma.testResult.findMany({
    where: { testId, userId },
    orderBy: { submittedAt: "desc" },
  });
  return {
    test,
    attemptsUsed: results.length,
    lastResult: results[0] ?? null,
  };
}

export async function submitTest(
  userId: string,
  testId: string,
  answers: AnswerInput[],
  startedAt?: string,
) {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test || !test.isEnabled) throw notFound("Test not found");
  const enrolled = await isEnrolled(userId, test.courseId);
  if (!enrolled) throw notFound("Enroll in the course first");
  await assertAttemptsAvailable(userId, test);

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
      score,
      total,
      percent,
      passed,
      answers: snapshot,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      timeTakenSeconds,
    },
  });

  let certificate: { id: string; number: string; pdfUrl: string | null } | null =
    null;
  if (passed) {
    const issued = await issueCertificateForTestPass(
      userId,
      test.courseId,
      result.id,
    );
    certificate = {
      id: issued.id,
      number: issued.certificateNumber,
      pdfUrl: issued.pdfUrl,
    };
  }

  return {
    result: {
      id: result.id,
      score,
      total,
      percent,
      passed,
      timeTakenSeconds,
    },
    certificate,
  };
}

async function assertAttemptsAvailable(
  userId: string,
  test: { id: string; attemptLimit: number },
): Promise<void> {
  const count = await prisma.testResult.count({ where: { testId: test.id, userId } });
  if (count >= test.attemptLimit) {
    throw forbidden("Attempt limit reached for this test");
  }
}
