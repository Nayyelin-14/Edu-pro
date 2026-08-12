import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";

export async function toggleWishlist(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, isPublished: true },
  });
  if (!course || !course.isPublished) throw notFound("Course not found");

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) {
    await prisma.wishlistItem.delete({
      where: { userId_courseId: { userId, courseId } },
    });
    return { saved: false };
  }
  await prisma.wishlistItem.create({ data: { userId, courseId } });
  return { saved: true };
}

export async function isWishlisted(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const row = await prisma.wishlistItem.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  return row !== null;
}

export async function listWishlist(userId: string) {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    include: {
      course: {
        include: { category: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ savedAt: r.createdAt, course: r.course }));
}
