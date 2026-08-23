import type { Prisma, ApprovalStatus } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/errors";
import { sanitizeRichHtml } from "@/lib/html";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { deleteAssetsAsync, isCloudinaryRef } from "@/server/services/upload.service";
import type { CreateLessonInput, UpdateLessonInput } from "@/lib/validation/course";

interface CourseInput {
  title?: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  price?: number;
  categoryId?: string | null;
  isFeatured?: boolean;
  difficulty?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  estimatedHours?: number | null;
  skills?: string[];
  prerequisites?: string[];
}

/**
 * `tenantId` MUST come from the author's trusted TenantContext — the course
 * is created inside the tenant the author is currently operating in.
 */
export async function createCourse(input: CourseInput, instructorId: string, tenantId: string) {
  const slug = await uniqueSlug(input.slug ?? slugify(input.title ?? "untitled"));
  return prisma.course.create({
    data: {
      tenantId,
      title: input.title ?? "Untitled course",
      slug,
      subtitle: input.subtitle,
      description: input.description ? sanitizeRichHtml(input.description) : null,
      coverImage: input.coverImage,
      price: input.price ?? 0,
      categoryId: input.categoryId ?? null,
      isFeatured: input.isFeatured ?? false,
      instructorId,
      approvalStatus: "DRAFT",
    },
  });
}

/**
 * TENANT-MODE update: `tenantId` MUST come from the caller's trusted
 * TenantContext. Cross-tenant ids resolve as "not found".
 */
export async function updateCourse(
  courseId: string,
  input: CourseInput,
  tenantId: string,
) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId },
  });
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
      ...(input.description !== undefined
        ? { description: input.description ? sanitizeRichHtml(input.description) : null }
        : {}),
      ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
      ...(input.estimatedHours !== undefined
        ? { estimatedHours: input.estimatedHours }
        : {}),
      ...(input.skills !== undefined ? { skills: input.skills as Prisma.InputJsonValue } : {}),
      ...(input.prerequisites !== undefined
        ? { prerequisites: input.prerequisites as Prisma.InputJsonValue }
        : {}),
    },
  });
}

/** TENANT-MODE delete: scoped to the caller's active tenant. */
export async function deleteCourse(courseId: string, tenantId: string): Promise<void> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId },
  });
  if (!course) throw notFound("Course not found");
  const assets = await prisma.asset.findMany({
    where: { courseId },
    select: { publicId: true, kind: true },
  });
  await prisma.course.delete({ where: { id: courseId } });
  // Lesson/Asset rows are cascade-deleted; media files go asynchronously.
  await deleteAssetsAsync(
    assets.map((a) => ({ publicId: a.publicId, kind: a.kind as "VIDEO" | "PDF" })),
  );
}

/**
 * `tenantId` is OPTIONAL and trusted: provided = TENANT MODE (staff console
 * status changes inside the active tenant); omitted = PLATFORM MODE
 * (explicit superadmin-only moderation across tenants).
 */
export async function setCourseStatus(
  courseId: string,
  status: ApprovalStatus,
  tenantId?: string,
) {
  const course = await prisma.course.findFirst({
    where: tenantId ? { id: courseId, tenantId } : { id: courseId },
  });
  if (!course) throw notFound("Course not found");
  return prisma.course.update({
    where: { id: courseId },
    data: {
      approvalStatus: status,
      isPublished: status === "APPROVED",
    },
  });
}

export async function listAdminCourses(
  input: {
    search?: string;
    status?:
      | "ALL"
      | "PUBLISHED"
      | "DRAFT"
      | "PENDING_REVIEW"
      | "APPROVED"
      | "REJECTED";
    categoryId?: string;
    page: number;
    pageSize: number;
  },
  scope: {
    /** TENANT MODE: both fields set. PLATFORM MODE (SUPERADMIN): omit both. */
    tenantId?: string;
    instructorId?: string;
  },
) {
  const where: Prisma.CourseWhereInput = {
    // TENANT MODE: the active tenant is a hard filter.
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
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
      : input.status && input.status !== "ALL"
        ? { approvalStatus: input.status as ApprovalStatus }
        : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(scope.instructorId ? { instructorId: scope.instructorId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        instructor: { select: { id: true, username: true } },
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

/** TENANT-MODE read: scoped to the caller's active tenant. */
export async function getAdminCourse(courseId: string, tenantId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId },
    include: {
      category: { select: { id: true, name: true } },
      instructor: { select: { id: true, username: true } },
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
  // Module tenant derives AUTHORITATIVELY from the parent course row.
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true, tenantId: true },
  });
  if (!course) throw notFound("Course not found");
  const position = input.position ?? (await nextPosition(input.courseId, "module"));
  return prisma.module.create({
    data: {
      courseId: input.courseId,
      tenantId: course.tenantId,
      title: input.title,
      description: input.description ? sanitizeRichHtml(input.description) : null,
      position,
    },
  });
}

/** TENANT-MODE update: scoped to the caller's active tenant. */
export async function updateModule(
  moduleId: string,
  input: { title?: string; description?: string | null; position?: number },
  tenantId: string,
) {
  const mod = await prisma.module.findFirst({
    where: { id: moduleId, tenantId },
  });
  if (!mod) throw notFound("Module not found");
  return prisma.module.update({
    where: { id: moduleId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description ? sanitizeRichHtml(input.description) : null }
        : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
    },
  });
}

/** TENANT-MODE delete: scoped to the caller's active tenant. */
export async function deleteModule(moduleId: string, tenantId: string): Promise<void> {
  const mod = await prisma.module.findFirst({
    where: { id: moduleId, tenantId },
  });
  if (!mod) throw notFound("Module not found");
  await prisma.module.delete({ where: { id: moduleId } });
}
/**
 * Server-authoritative content rules (spec §1). The Zod layer validates first;
 * these guards re-check every combination because the service is also called
 * from non-API paths. DB CHECK constraints enforce exclusivity last.
 */
export function assertContentConsistent(input: {
  type: "VIDEO" | "READING";
  videoUrl?: string | null;
  article?: string | null;
  pdfUrl?: string | null;
}) {
  const hasVideo = !!input.videoUrl;
  const hasArticle = typeof input.article === "string" && input.article.trim().length > 0;
  const hasPdf = !!input.pdfUrl;
  if (input.type === "VIDEO") {
    if (!hasVideo) throw badRequest("A VIDEO lesson requires a video");
    if (hasArticle || hasPdf) {
      throw badRequest("A VIDEO lesson cannot contain reading material");
    }
    return;
  }
  if (hasVideo) throw badRequest("A READING lesson cannot contain a video");
  if (hasArticle === hasPdf) {
    throw badRequest(
      "A READING lesson needs exactly one content source: article or PDF",
    );
  }
}

export async function createLesson(input: CreateLessonInput) {
  assertContentConsistent({
    type: input.type,
    videoUrl: input.videoUrl,
    article: input.article,
    pdfUrl: input.pdfUrl,
  });
  const mod = await prisma.module.findUnique({
    where: { id: input.moduleId },
    select: { id: true, tenantId: true },
  });
  if (!mod) throw notFound("Module not found");
  const position = input.position ?? (await nextPosition(input.moduleId, "lesson"));
  return prisma.lesson.create({
    data: {
      moduleId: input.moduleId,
      tenantId: mod.tenantId,
      title: input.title,
      type: input.type,
      // Normalize undefined -> null: Prisma treats undefined as "no change",
      // which could leave stale content behind a type switch.
      videoUrl: input.videoUrl ?? null,
      videoDuration: input.videoDuration,
      article:
        input.type === "READING" && input.article
          ? sanitizeRichHtml(input.article)
          : null,
      pdfUrl: input.type === "READING" ? (input.pdfUrl ?? null) : null,
      position,
      isFree: input.isFree ?? false,
    },
  });
}

/**
 * TENANT-MODE update, scoped to the caller's active tenant. Content fields are
 * atomic: the payload carries the complete desired content for the lesson.
 */
export async function updateLesson(
  lessonId: string,
  input: UpdateLessonInput,
  tenantId: string,
) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, tenantId },
  });
  if (!lesson) throw notFound("Lesson not found");

  assertContentConsistent({
    type: input.type,
    videoUrl: input.videoUrl,
    article: input.article,
    pdfUrl: input.pdfUrl,
  });

  // Replacing/removing provider-backed media? Delete old files asynchronously
  // AFTER the row references the new content.
  const removedRefs: { publicId: string; kind: "VIDEO" | "PDF" }[] = [];
  const contentBeforeAfter = [
    { kind: "VIDEO", before: lesson.videoUrl, after: input.videoUrl },
    { kind: "PDF", before: lesson.pdfUrl, after: input.pdfUrl },
  ] as const;
  for (const { kind, before, after } of contentBeforeAfter) {
    if (before && before !== after && isCloudinaryRef(before)) {
      removedRefs.push({ publicId: before.slice("cloudinary:".length), kind });
    }
  }

  const updated = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      type: input.type,
      // Normalize undefined -> null (see createLesson): content is atomic on
      // every content-bearing PATCH.
      videoUrl: input.videoUrl ?? null,
      videoDuration: input.videoDuration ?? null,
      article:
        input.type === "READING" && input.article
          ? sanitizeRichHtml(input.article)
          : null,
      pdfUrl: input.type === "READING" ? (input.pdfUrl ?? null) : null,
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.isFree !== undefined ? { isFree: input.isFree } : {}),
    },
  });

  if (removedRefs.length > 0) {
    await deleteAssetsAsync(removedRefs);
    // Retire Asset rows of files this lesson no longer references; their
    // objects are deleted by the async job above.
    await prisma.asset.deleteMany({
      where: { lessonId, publicId: { in: removedRefs.map((r) => r.publicId) } },
    });
  }
  return updated;
}

/**
 * TENANT-MODE delete: scoped to the caller's active tenant. Media files are
 * deleted ASYNCHRONOUSLY after the DB row is gone (spec §16).
 */
export async function deleteLesson(lessonId: string, tenantId: string): Promise<void> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, tenantId },
  });
  if (!lesson) throw notFound("Lesson not found");
  const assets = await prisma.asset.findMany({
    where: { lessonId },
    select: { publicId: true, kind: true },
  });
  await prisma.asset.deleteMany({ where: { lessonId } });
  await prisma.lesson.delete({ where: { id: lessonId } });
  await deleteAssetsAsync(
    assets.map((a) => ({ publicId: a.publicId, kind: a.kind as "VIDEO" | "PDF" })),
  );
}
