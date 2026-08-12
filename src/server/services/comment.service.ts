import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { isEnrolled } from "./enrollment.service";

export async function createComment(
  userId: string,
  input: { lessonId: string; content: string; parentId?: string },
) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: input.lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson) throw notFound("Lesson not found");

  const enrolled = await isEnrolled(userId, lesson.module.courseId);
  if (!enrolled) throw forbidden("Enroll in the course to comment");

  if (input.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: input.parentId },
    });
    if (!parent || parent.lessonId !== input.lessonId) {
      throw badRequest("Parent comment is invalid");
    }
  }

  return prisma.comment.create({
    data: {
      userId,
      lessonId: input.lessonId,
      content: input.content,
      parentId: input.parentId || null,
    },
    include: { user: { select: { id: true, username: true, avatar: true } } },
  });
}

export async function listCommentsByLesson(lessonId: string) {
  const comments = await prisma.comment.findMany({
    where: { lessonId },
    include: {
      user: { select: { id: true, username: true, avatar: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const top = comments.filter((c) => !c.parentId);
  const byParent = new Map<string, typeof comments>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const list = byParent.get(comment.parentId) ?? [];
    list.push(comment);
    byParent.set(comment.parentId, list);
  }
  return top.map((c) => ({
    ...c,
    replies: byParent.get(c.id) ?? [],
  }));
}

export async function updateComment(
  userId: string,
  commentId: string,
  content: string,
) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw notFound("Comment not found");
  if (comment.userId !== userId) throw forbidden("Not your comment");
  return prisma.comment.update({
    where: { id: commentId },
    data: { content },
  });
}

export async function deleteComment(userId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw notFound("Comment not found");
  if (comment.userId !== userId) throw forbidden("Not your comment");
  await prisma.comment.delete({ where: { id: commentId } });
  return { success: true };
}
