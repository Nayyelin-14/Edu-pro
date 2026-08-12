import { prisma } from "@/lib/prisma";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { isEnrolled } from "./enrollment.service";

export async function createReview(
  userId: string,
  input: { courseId: string; rating: number; content?: string },
) {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true, isPublished: true },
  });
  if (!course || !course.isPublished) throw notFound("Course not found");

  const enrolled = await isEnrolled(userId, input.courseId);
  if (!enrolled) throw forbidden("Enroll in the course before reviewing it");

  const existing = await prisma.review.findUnique({
    where: { userId_courseId: { userId, courseId: input.courseId } },
  });
  if (existing) throw conflict("You have already reviewed this course");

  const review = await prisma.review.create({
    data: {
      userId,
      courseId: input.courseId,
      rating: input.rating,
      content: input.content || null,
    },
  });
  await recomputeRating(input.courseId);
  return review;
}

export async function updateReview(
  userId: string,
  reviewId: string,
  input: { rating?: number; content?: string | null },
) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw notFound("Review not found");
  if (review.userId !== userId) throw forbidden("Not your review");

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

export async function hasReviewed(userId: string, courseId: string) {
  const review = await prisma.review.findUnique({
    where: { userId_courseId: { userId, courseId } },
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
