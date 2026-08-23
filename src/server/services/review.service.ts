import { prisma } from "@/lib/prisma";
import { conflict, forbidden, notFound } from "@/lib/errors";
import type { TenantContext } from "@/server/tenant-context";
import { isEnrolled } from "./enrollment.service";

export async function createReview(
  ctx: TenantContext,
  input: { courseId: string; rating: number; content?: string },
) {
  const userId = ctx.user.id;
  // Tenant-scoped course lookup: cross-tenant ids resolve as "not found".
  const course = await prisma.course.findFirst({
    where: { id: input.courseId, tenantId: ctx.tenant.id },
    select: { id: true, isPublished: true },
  });
  if (!course || !course.isPublished) throw notFound("Course not found");

  const enrolled = await isEnrolled(userId, input.courseId, ctx.tenant.id);
  if (!enrolled) throw forbidden("Enroll in the course before reviewing it");

  const existing = await prisma.review.findFirst({
    where: { userId, courseId: input.courseId, tenantId: ctx.tenant.id },
  });
  if (existing) throw conflict("You have already reviewed this course");

  const review = await prisma.review.create({
    data: {
      userId,
      courseId: input.courseId,
      tenantId: ctx.tenant.id,
      rating: input.rating,
      content: input.content || null,
    },
  });
  await recomputeRating(input.courseId);
  return review;
}

export async function updateReview(
  ctx: TenantContext,
  reviewId: string,
  input: { rating?: number; content?: string | null },
) {
  const userId = ctx.user.id;
  // Tenant-scoped + owner-scoped lookup (IDOR-safe).
  const review = await prisma.review.findFirst({
    where: { id: reviewId, userId, tenantId: ctx.tenant.id },
  });
  if (!review) throw notFound("Review not found");

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
    },
  });
  await recomputeRating(review.courseId);
  return updated;
}

export async function listCourseReviews(courseId: string) {
  return prisma.review.findMany({
    where: { courseId },
    include: {
      user: { select: { id: true, username: true, avatar: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function hasReviewed(ctx: TenantContext, courseId: string) {
  const review = await prisma.review.findFirst({
    where: { userId: ctx.user.id, courseId, tenantId: ctx.tenant.id },
    select: { id: true, rating: true, content: true },
  });
  return review;
}

async function recomputeRating(courseId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { courseId },
    _avg: { rating: true },
    _count: true,
  });
  const rating = agg._avg.rating ?? 0;
  await prisma.course.update({
    where: { id: courseId },
    data: { rating: Number(rating.toFixed(1)), ratingCount: agg._count },
  });
}
