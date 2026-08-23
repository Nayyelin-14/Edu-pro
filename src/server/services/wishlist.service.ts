import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import type { TenantContext } from "@/server/tenant-context";

export async function toggleWishlist(ctx: TenantContext, courseId: string) {
  const userId = ctx.user.id;
  // Tenant-scoped course lookup: cross-tenant ids resolve as "not found".
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId: ctx.tenant.id },
    select: { id: true, isPublished: true },
  });
  if (!course || !course.isPublished) throw notFound("Course not found");

  const existing = await prisma.wishlistItem.findFirst({
    where: { userId, courseId, tenantId: ctx.tenant.id },
  });
  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return { saved: false };
  }
  await prisma.wishlistItem.create({
    data: { userId, courseId, tenantId: ctx.tenant.id },
  });
  return { saved: true };
}

export async function isWishlisted(
  ctx: TenantContext,
  courseId: string,
): Promise<boolean> {
  const row = await prisma.wishlistItem.findFirst({
    where: { userId: ctx.user.id, courseId, tenantId: ctx.tenant.id },
    select: { id: true },
  });
  return row !== null;
}

export async function listWishlist(ctx: TenantContext) {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId: ctx.user.id, tenantId: ctx.tenant.id },
    include: {
      course: {
        include: { category: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ savedAt: r.createdAt, course: r.course }));
}
