"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  CircleDollarSign,
  Star,
  Award,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import {
  AdminPageHeader,
  AdminStatCard,
  StatusBadge,
  TableShell,
  TableTh,
  TableTd,
} from "@/components/admin/admin-ui";

interface InstructorAnalytics {
  overview: {
    totalCourses: number;
    publishedCourses: number;
    totalEnrollments: number;
    totalRevenue: number;
    totalCertificates: number;
    avgRating: number;
  };
  enrollmentTrend: Array<{ month: string; count: number }>;
  courses: Array<{
    id: string;
    slug: string;
    title: string;
    isPublished: boolean;
    studentCount: number;
    rating: number;
    ratingCount: number;
    revenue: number;
    certificates: number;
    growth: number;
  }>;
}

function formatBaht(value: number): string {
  return value >= 1000
    ? `฿${(value / 1000).toFixed(1)}k`
    : `฿${value.toLocaleString("en-US")}`;
}

export function AdminAnalytics() {
  const [data, setData] = useState<InstructorAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<InstructorAnalytics>("/api/staff/stats/instructor")
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center text-destructive">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const { overview, enrollmentTrend, courses } = data;

  const kpis = [
    {
      label: "Courses",
      value: `${overview.totalCourses}`,
      sub: `${overview.publishedCourses} published`,
      icon: BookOpen,
      color: "from-indigo-500 to-violet-600",
    },
    {
      label: "Total Enrollments",
      value: overview.totalEnrollments.toLocaleString(),
      icon: GraduationCap,
      color: "from-cyan-500 to-blue-500",
    },
    {
      label: "Revenue",
      value: formatBaht(overview.totalRevenue),
      icon: CircleDollarSign,
      color: "from-emerald-500 to-teal-600",
    },
    {
      label: "Avg Rating",
      value: overview.avgRating.toFixed(1),
      icon: Star,
      color: "from-amber-400 to-orange-500",
    },
    {
      label: "Certificates",
      value: overview.totalCertificates.toLocaleString(),
      icon: Award,
      color: "from-pink-500 to-rose-500",
    },
  ];

  const topCourse = courses[0];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Instructor Analytics"
        subtitle="Performance of the courses you teach."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ label, value, sub, icon: Icon, color }) => (
          <AdminStatCard key={label} label={label} value={value} sub={sub} icon={Icon} color={color} />
        ))}
      </div>

      {overview.totalCourses === 0 ? (
        <Card className="p-12 border-border/50 shadow-sm text-center">
          <BarChart3 className="mx-auto size-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            No courses yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first course to start tracking performance.
          </p>
          <Link
            href="/staff/courses/new"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Create a course
          </Link>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 p-6 border-border/50 shadow-sm">
              <h3 className="mb-6 text-lg font-semibold text-foreground">
                Enrollments (last 6 months)
              </h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={enrollmentTrend}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="instructorEnroll" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#instructorEnroll)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6 border-border/50 shadow-sm flex flex-col">
              <h3 className="mb-6 text-lg font-semibold text-foreground">
                Best performing course
              </h3>
              {topCourse ? (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="size-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/staff/courses/${topCourse.id}`}
                        className="text-sm font-semibold text-foreground truncate hover:underline"
                      >
                        {topCourse.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {topCourse.studentCount.toLocaleString()} students
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rating</span>
                      <span className="font-medium text-foreground">
                        {topCourse.rating.toFixed(1)} ({topCourse.ratingCount})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-medium text-foreground">
                        {formatBaht(topCourse.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Certificates</span>
                      <span className="font-medium text-foreground">
                        {topCourse.certificates}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">30-day growth</span>
                      <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <ArrowUpRight className="size-3.5" />
                        {topCourse.growth}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No course data.</p>
              )}
            </Card>
          </div>

          <TableShell>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold text-foreground">Your courses</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <TableTh>Course</TableTh>
                    <TableTh>Status</TableTh>
                    <TableTh>Students</TableTh>
                    <TableTh>Rating</TableTh>
                    <TableTh>Revenue</TableTh>
                    <TableTh>Certificates</TableTh>
                    <TableTh>30-day</TableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {courses.map((course) => (
                    <tr key={course.id} className="transition-colors hover:bg-muted/20">
                      <TableTd>
                        <Link
                          href={`/staff/courses/${course.id}`}
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          {course.title}
                        </Link>
                      </TableTd>
                      <TableTd>
                        <StatusBadge status={course.isPublished ? "ACTIVE" : "DRAFT"} />
                      </TableTd>
                      <TableTd className="font-mono text-muted-foreground">
                        {course.studentCount.toLocaleString()}
                      </TableTd>
                      <TableTd className="font-mono text-amber-500">
                        {course.rating.toFixed(1)}
                      </TableTd>
                      <TableTd className="font-mono font-semibold text-foreground">
                        {formatBaht(course.revenue)}
                      </TableTd>
                      <TableTd className="font-mono text-muted-foreground">
                        {course.certificates}
                      </TableTd>
                      <TableTd>
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-medium ${
                            course.growth >= 0
                              ? "text-emerald-500"
                              : "text-destructive"
                          }`}
                        >
                          {course.growth >= 0 ? (
                            <TrendingUp className="size-3.5" />
                          ) : (
                            <TrendingDown className="size-3.5" />
                          )}
                          {course.growth}%
                        </span>
                      </TableTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableShell>
        </>
      )}
    </div>
  );
}