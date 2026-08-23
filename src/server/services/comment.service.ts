import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import type { TenantContext } from "@/server/tenant-context";
import { isEnrolled } from "./enrollment.service";

export async function createComment(
  ctx: TenantContext,
  input: { lessonId: string; content: string; parentId?: string },
) {
  const userId = ctx.user.id;
  // Tenant-scoped lesson lookup: comments only within the active tenant.
  const lesson = await prisma.lesson.findFirst({
    where: { id: input.lessonId, tenantId: ctx.tenant.id },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson) throw notFound("Lesson not found");

  const enrolled = await isEnrolled(userId, lesson.module.courseId, ctx.tenant.id);
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

/** TENANT MODE: the lesson must belong to the caller's active tenant. */
export async function listCommentsByLesson(lessonId: string, ctx: TenantContext) {
  const comments = await prisma.comment.findMany({
    where: { lessonId, lesson: { tenantId: ctx.tenant.id } },
    include: {
      user: { select: { id: true, username: true, avatar: true } },
      likes: ctx.user.id
        ? { where: { userId: ctx.user.id }, select: { commentId: true } }
        : undefined,
    },
    orderBy: { createdAt: "asc" },
  });
  const likedIds = new Set(comments.flatMap((c) => c.likes.map((l) => l.commentId)));
  const serialized = comments.map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt,
    parentId: c.parentId,
    userId: c.userId,
    user: c.user,
    likeCount: c.likeCount,
    liked: likedIds.has(c.id),
  }));
  const top = serialized.filter((c) => !c.parentId);
  const byParent = new Map<string, typeof serialized>();
  for (const comment of serialized) {
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

export async function toggleCommentLike(ctx: TenantContext, commentId: string) {
  const userId = ctx.user.id;
  // Tenant gate: the comment's lesson must belong to the caller's tenant.
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, lesson: { tenantId: ctx.tenant.id } },
    select: { id: true, likeCount: true },
  });
  if (!comment) throw notFound("Comment not found");

  const existing = await prisma.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.commentLike.delete({ where: { id: existing.id } }),
      prisma.comment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    return { liked: false, likeCount: Math.max(0, comment.likeCount - 1) };
  }

  await prisma.$transaction([
    prisma.commentLike.create({ data: { commentId, userId } }),
    prisma.comment.update({
      where: { id: commentId },
      data: { likeCount: { increment: 1 } },
    }),
  ]);
  return { liked: true, likeCount: comment.likeCount + 1 };
}

/** TENANT MODE: the comment's lesson must belong to the caller's active tenant. */
export async function updateComment(
  ctx: TenantContext,
  commentId: string,
  content: string,
) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, lesson: { tenantId: ctx.tenant.id } },
  });
  if (!comment) throw notFound("Comment not found");
  if (comment.userId !== ctx.user.id) throw forbidden("Not your comment");
  return prisma.comment.update({
    where: { id: commentId },
    data: { content },
  });
}

/** TENANT MODE: the comment's lesson must belong to the caller's active tenant. */
export async function deleteComment(ctx: TenantContext, commentId: string) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, lesson: { tenantId: ctx.tenant.id } },
  });
  if (!comment) throw notFound("Comment not found");
  if (comment.userId !== ctx.user.id) throw forbidden("Not your comment");
  await prisma.comment.delete({ where: { id: commentId } });
  return { success: true };
}
