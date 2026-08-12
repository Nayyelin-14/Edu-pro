import type { Prisma } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

interface CourseInput {
  title?: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  price?: number;
  categoryId?: string | null;
  isFeatured?: boolean;
}

export async function createCourse(input: CourseInput) {
  const slug = await uniqueSlug(input.slug ?? slugify(input.title ?? "untitled"));
  return prisma.course.create({
    data: {
      title: input.title ?? "Untitled course",
      slug,
      subtitle: input.subtitle,
      description: input.description,
      coverImage: input.coverImage,
      price: input.price ?? 0,
      categoryId: input.categoryId ?? null,
      isFeatured: input.isFeatured ?? false,
    },
  });
}

export async function updateCourse(courseId: string, input: CourseInput) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Course not found");

  const slug = input.slug;
  if (slug && slug !== course.slug) {
    const taken = await prisma.course.findUnique({ where: { slug } });
    if (taken) throw badRequest("That slug is already in use");
  }

  return prisma.course.update({
    where: { id: courseId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
    },
  });
}

export async function deleteCourse(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Course not found");
  await prisma.course.delete({ where: { id: courseId } });
}

export async function setCoursePublished(courseId: string, published: boolean) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw notFound("Course not found");
  return prisma.course.update({
    where: { id: courseId },
    data: { isPublished: published },
  });
}

export async function listAdminCourses(input: {
  search?: string;
  status?: "ALL" | "PUBLISHED" | "DRAFT";
  categoryId?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.CourseWhereInput = {
    ...(input.search
      ? {
          OR: [
            { title: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(input.status === "PUBLISHED"
      ? { isPublished: true }
      : input.status === "DRAFT"
        ? { isPublished: false }
        : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { modules: true, enrollments: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.course.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function getAdminCourse(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      category: { select: { id: true, name: true } },
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: { orderBy: { position: "asc" } },
          quizzes: { select: { id: true, title: true, questions: true } },
        },
      },
      tests: true,
    },
  });
  if (!course) throw notFound("Course not found");
  return course;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || "course";
  let i = 2;
  while (await prisma.course.findUnique({ where: { slug } })) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

async function nextPosition(
  parentId: string,
  kind: "module" | "lesson",
): Promise<number> {
  if (kind === "module") {
    const agg = await prisma.module.aggregate({
      where: { courseId: parentId },
      _max: { position: true },
    });
    return (agg._max.position ?? -1) + 1;
  }
  const agg = await prisma.lesson.aggregate({
    where: { moduleId: parentId },
    _max: { position: true },
  });
  return (agg._max.position ?? -1) + 1;
}

export async function createModule(input: {
  courseId: string;
  title: string;
  description?: string;
  position?: number;
}) {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true },
  });
  if (!course) throw notFound("Course not found");
  const position = input.position ?? (await nextPosition(input.courseId, "module"));
  return prisma.module.create({
    data: {
      courseId: input.courseId,
      title: input.title,
      description: input.description,
      position,
    },
  });
}

export async function updateModule(
  moduleId: string,
  input: { title?: string; description?: string | null; position?: number },
) {
  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) throw notFound("Module not found");
  return prisma.module.update({
    where: { id: moduleId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
    },
  });
}

export async function deleteModule(moduleId: string): Promise<void> {
  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) throw notFound("Module not found");
  await prisma.module.delete({ where: { id: moduleId } });
}

export async function createLesson(input: {
  moduleId: string;
  title: string;
  videoUrl?: string;
  videoDuration?: number;
  article?: string;
  position?: number;
  isFree?: boolean;
}) {
  const mod = await prisma.module.findUnique({
    where: { id: input.moduleId },
    select: { id: true },
  });
  if (!mod) throw notFound("Module not found");
  const position = input.position ?? (await nextPosition(input.moduleId, "lesson"));
  return prisma.lesson.create({
    data: {
      moduleId: input.moduleId,
      title: input.title,
      videoUrl: input.videoUrl,
      videoDuration: input.videoDuration,
      article: input.article,
      position,
      isFree: input.isFree ?? false,
    },
  });
}

export async function updateLesson(
  lessonId: string,
  input: {
    title?: string;
    videoUrl?: string | null;
    videoDuration?: number;
    article?: string | null;
    position?: number;
    isFree?: boolean;
  },
) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw notFound("Lesson not found");
  return prisma.lesson.update({
    where: { id: lessonId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl } : {}),
      ...(input.videoDuration !== undefined ? { videoDuration: input.videoDuration } : {}),
      ...(input.article !== undefined ? { article: input.article } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.isFree !== undefined ? { isFree: input.isFree } : {}),
    },
  });
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw notFound("Lesson not found");
  await prisma.lesson.delete({ where: { id: lessonId } });
}
