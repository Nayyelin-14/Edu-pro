import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.APP_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/courses`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/certificates/verify`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const { prisma } = await import("@/lib/prisma");

  const [courses, categories] = await Promise.all([
    prisma.course.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.category.findMany({
      select: { id: true },
    }),
  ]);

  for (const course of courses) {
    routes.push({
      url: `${BASE_URL}/courses/${course.slug}`,
      lastModified: course.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const category of categories) {
    routes.push({
      url: `${BASE_URL}/courses?category=${encodeURIComponent(category.id)}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return routes;
}