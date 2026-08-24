import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";

export async function getDashboardStats() {
  const now = Date.now();
  const last30 = new Date(now - 30 * 86_400_000);
  const prev30 = new Date(now - 60 * 86_400_000);

  const [
    totalUsers,
    totalStudents,
      totalInstructors,
    totalCourses,
    publishedCourses,
    totalEnrollments,
    totalCertificates,
    pendingReports,
    recentUsers,
    popularCourses,
    newUsers30,
    newUsersPrev30,
    newEnrollments30,
    newEnrollmentsPrev30,
    newCertificates30,
    newCertificatesPrev30,
    newCourses30,
    newCoursesPrev30,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: { in: [UserRole.INSTRUCTOR, UserRole.SUPERADMIN] } } }),
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
    prisma.user.count({ where: { createdAt: { gte: last30 } } }),
    prisma.user.count({ where: { createdAt: { gte: prev30, lt: last30 } } }),
    prisma.enrollment.count({ where: { createdAt: { gte: last30 } } }),
    prisma.enrollment.count({ where: { createdAt: { gte: prev30, lt: last30 } } }),
    prisma.certificate.count({ where: { issuedAt: { gte: last30 } } }),
    prisma.certificate.count({ where: { issuedAt: { gte: prev30, lt: last30 } } }),
    prisma.course.count({ where: { createdAt: { gte: last30 } } }),
    prisma.course.count({ where: { createdAt: { gte: prev30, lt: last30 } } }),
  ]);

  // Real 30-day vs previous-30-day growth, computed from the same counters —
  // never hardcoded. 0 in the previous window with growth reports +100%.
  const pct = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return {
    counts: {
      totalUsers,
      totalStudents,
    totalInstructors,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      totalCertificates,
      pendingReports,
    },
    trends: {
      users: pct(newUsers30, newUsersPrev30),
      courses: pct(newCourses30, newCoursesPrev30),
      enrollments: pct(newEnrollments30, newEnrollmentsPrev30),
      certificates: pct(newCertificates30, newCertificatesPrev30),
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

export async function getRevenueGrowth(months = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { status: "PAID", completedAt: { gte: since } },
    select: { completedAt: true, amountPaid: true },
  });

  const monthsMap = new Map<string, number>();
  for (let i = 0; i < months; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
    monthsMap.set(key, 0);
  }

  for (const o of orders) {
    const key = new Date(o.completedAt!).toLocaleString("default", { month: "short", year: "2-digit" });
    monthsMap.set(key, (monthsMap.get(key) ?? 0) + o.amountPaid);
  }

  return Array.from(monthsMap.entries())
    .reverse()
    .map(([month, revenue]) => ({ month, revenue }));
}

export async function getRevenueByCategory() {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    include: {
      category: { select: { name: true } },
      orders: {
        where: { status: "PAID" },
        select: { amountPaid: true },
      },
    },
  });

  const categoryRevenue = new Map<string, number>();
  for (const course of courses) {
    const cat = course.category?.name ?? "Uncategorized";
    const revenue = course.orders.reduce((a, o) => a + o.amountPaid, 0);
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
      orders: {
        where: { status: "PAID" },
        select: { amountPaid: true },
      },
    },
    orderBy: { studentCount: "desc" },
    take: limit,
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  return courses.map((course) => {
    const revenue = course.orders.reduce((a, o) => a + o.amountPaid, 0);
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

/**
 * Analytics scoped to a single instructor's own courses INSIDE one tenant.
 * `tenantId` MUST come from the caller's trusted TenantContext — analytics
 * never span tenants.
 */
export async function getInstructorAnalytics(userId: string, tenantId: string) {
  const courses = await prisma.course.findMany({
    where: { instructorId: userId, tenantId },
    include: {
      enrollments: { select: { id: true, createdAt: true } },
      orders: {
        where: { status: "PAID" },
        select: { amountPaid: true, createdAt: true },
      },
      certificates: { select: { id: true } },
      reviews: { select: { rating: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalEnrollments = courses.reduce(
    (a, c) => a + c.enrollments.length,
    0,
  );
  const totalRevenue = courses.reduce(
    (a, c) => a + c.orders.reduce((x, o) => x + o.amountPaid, 0),
    0,
  );
  const totalCertificates = courses.reduce(
    (a, c) => a + c.certificates.length,
    0,
  );
  const allRatings = courses.flatMap((c) =>
    c.reviews.map((r) => r.rating),
  );
  const avgRating = allRatings.length
    ? Number(
        (allRatings.reduce((a, r) => a + r, 0) / allRatings.length).toFixed(1),
      )
    : 0;

  // Enrollment trend over the last 6 months, aggregated across the
  // instructor's courses.
  const trendMonths = 6;
  const since = new Date();
  since.setMonth(since.getMonth() - trendMonths);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const monthsMap = new Map<string, number>();
  for (let i = 0; i < trendMonths; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleString("default", {
      month: "short",
      year: "2-digit",
    });
    monthsMap.set(key, 0);
  }
  for (const course of courses) {
    for (const e of course.enrollments) {
      if (new Date(e.createdAt) < since) continue;
      const key = new Date(e.createdAt).toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
      monthsMap.set(key, (monthsMap.get(key) ?? 0) + 1);
    }
  }
  const enrollmentTrend = Array.from(monthsMap.entries())
    .reverse()
    .map(([month, count]) => ({ month, count }));

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const courseRows = courses.map((course) => {
    const revenue = course.orders.reduce((a, o) => a + o.amountPaid, 0);
    const recentEnrollments = course.enrollments.filter(
      (e) => new Date(e.createdAt) >= thirtyDaysAgo,
    ).length;
    const previousEnrollments = course.enrollments.filter(
      (e) =>
        new Date(e.createdAt) >= sixtyDaysAgo &&
        new Date(e.createdAt) < thirtyDaysAgo,
    ).length;
    const growth =
      previousEnrollments > 0
        ? Math.round(
            ((recentEnrollments - previousEnrollments) /
              previousEnrollments) *
              100,
          )
        : recentEnrollments > 0
          ? 100
          : 0;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      isPublished: course.isPublished,
      studentCount: course.studentCount,
      rating: course.rating,
      ratingCount: course.reviews.length,
      revenue,
      certificates: course.certificates.length,
      growth,
    };
  });

  return {
    overview: {
      totalCourses: courses.length,
      publishedCourses: courses.filter((c) => c.isPublished).length,
      totalEnrollments,
      totalRevenue,
      totalCertificates,
      avgRating,
    },
    enrollmentTrend,
    courses: courseRows,
  };
}
