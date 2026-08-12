import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";

export interface CatalogQuery {
  search?: string;
  categoryId?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  sort?: "POPULAR" | "NEWEST" | "RATING" | "PRICE_ASC" | "ALL";
  page: number;
  pageSize: number;
}

export async function listPublishedCourses(query: CatalogQuery) {
  const where: Prisma.CourseWhereInput = {
    isPublished: true,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { subtitle: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.categories?.length
      ? { categoryId: { in: query.categories } }
      : query.categoryId
        ? { categoryId: query.categoryId }
        : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          price: {
            ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
            ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
          },
        }
      : {}),
  };
  const orderBy =
    query.sort === "POPULAR"
      ? { studentCount: "desc" as const }
      : query.sort === "RATING"
        ? { rating: "desc" as const }
        : query.sort === "PRICE_ASC"
          ? { price: "asc" as const }
          : { createdAt: "desc" as const };
  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.course.count({ where }),
  ]);
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { courses: true } } },
  });
}

/** Public course page: lesson bodies are stripped unless the lesson is free. */
export async function getCoursePage(slug: string) {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              title: true,
              position: true,
              isFree: true,
              videoDuration: true,
            },
          },
          quizzes: { select: { id: true, title: true } },
        },
      },
      reviews: {
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      tests: {
        where: { isEnabled: true },
        select: {
          id: true,
          title: true,
          description: true,
          passingScore: true,
          timeLimitMinutes: true,
          attemptLimit: true,
        },
      },
    },
  });
  if (!course || !course.isPublished) throw notFound("Course not found");
  return course;
}

export async function getCourseForLearning(courseId: string, userId: string) {
  const [course, completedRows] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { position: "asc" },
          include: {
            lessons: { orderBy: { position: "asc" } },
            quizzes: { select: { id: true, title: true, questions: true } },
          },
        },
        tests: {
          where: { isEnabled: true },
          select: {
            id: true,
            title: true,
            description: true,
            passingScore: true,
            timeLimitMinutes: true,
            attemptLimit: true,
            questions: true,
          },
        },
      },
    }),
    prisma.completedLesson.findMany({
      where: { userId },
      select: { lessonId: true },
    }),
  ]);
  if (!course) throw notFound("Course not found");
  return {
    course,
    completedLessonIds: completedRows.map((c) => c.lessonId),
  };
}

export async function courseExists(courseId: string): Promise<boolean> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  return course !== null;
}
