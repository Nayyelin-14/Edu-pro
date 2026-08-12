import { prisma } from "@/lib/prisma";
import { conflict } from "@/lib/errors";

export async function updateProfile(
  userId: string,
  input: { username?: string; avatar?: string },
) {
  if (input.username) {
    const existing = await prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      throw conflict("Username is already in use");
    }
  }
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.username ? { username: input.username } : {}),
      ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
    },
  });
}

export async function getUserScores(userId: string) {
  const [quizResults, testResults] = await Promise.all([
    prisma.quizResult.findMany({
      where: { userId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            module: { select: { course: { select: { id: true, title: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.testResult.findMany({
      where: { userId },
      include: {
        test: { select: { id: true, title: true, course: { select: { id: true, title: true } } } },
      },
      orderBy: { submittedAt: "desc" },
    }),
  ]);
  return { quizResults, testResults };
}
