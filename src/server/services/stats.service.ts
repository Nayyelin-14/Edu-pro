import { prisma } from "@/lib/prisma";

export async function getDashboardStats() {
  const [
    totalUsers,
    totalStudents,
    totalAdmins,
    totalCourses,
    publishedCourses,
    totalEnrollments,
    totalCertificates,
    pendingReports,
    recentUsers,
    popularCourses,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: { in: ["ADMIN", "SUPERADMIN"] } } }),
    prisma.course.count(),
    prisma.course.count({ where: { isPublished: true } }),
    prisma.enrollment.count(),
    prisma.certificate.count(),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isBanned: true,
        createdAt: true,
      },
    }),
    prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { studentCount: "desc" },
      take: 5,
      select: {
        id: true,
        slug: true,
        title: true,
        studentCount: true,
        rating: true,
      },
    }),
  ]);

  return {
    counts: {
      totalUsers,
      totalStudents,
      totalAdmins,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      totalCertificates,
      pendingReports,
    },
    recentUsers,
    popularCourses,
  };
}

export async function getEnrollmentGrowth(months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const enrollments = await prisma.enrollment.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const monthsMap = new Map<string, number>();
  for (let i = 0; i < months; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
    monthsMap.set(key, 0);
  }

  for (const e of enrollments) {
    const key = new Date(e.createdAt).toLocaleString("default", { month: "short", year: "2-digit" });
    monthsMap.set(key, (monthsMap.get(key) ?? 0) + 1);
  }

  return Array.from(monthsMap.entries())
    .reverse()
    .map(([month, count]) => ({ month, count }));
}

export async function getRevenueByCategory() {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    include: {
      category: { select: { name: true } },
      enrollments: { select: { id: true } },
    },
  });

  const categoryRevenue = new Map<string, number>();
  for (const course of courses) {
    const cat = course.category?.name ?? "Uncategorized";
    const revenue = course.enrollments.length * course.price;
    categoryRevenue.set(cat, (categoryRevenue.get(cat) ?? 0) + revenue);
  }

  const total = Array.from(categoryRevenue.values()).reduce((a, b) => a + b, 0);
  return Array.from(categoryRevenue.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentage: total > 0 ? Math.round((revenue / total) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getTopCourses(limit = 3) {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    include: {
      category: { select: { name: true } },
      enrollments: { select: { id: true, createdAt: true } },
    },
    orderBy: { studentCount: "desc" },
    take: limit,
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  return courses.map((course) => {
    const revenue = course.enrollments.length * course.price;
    const recentEnrollments = course.enrollments.filter(
      (e) => new Date(e.createdAt) >= thirtyDaysAgo
    ).length;
    const previousEnrollments = course.enrollments.filter(
      (e) => new Date(e.createdAt) >= sixtyDaysAgo && new Date(e.createdAt) < thirtyDaysAgo
    ).length;
    const growth = previousEnrollments > 0
      ? Math.round(((recentEnrollments - previousEnrollments) / previousEnrollments) * 100)
      : recentEnrollments > 0 ? 100 : 0;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      price: course.price,
      studentCount: course.studentCount,
      rating: course.rating,
      category: course.category,
      revenue,
      growth,
    };
  });
}
