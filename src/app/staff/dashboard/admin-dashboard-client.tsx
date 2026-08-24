"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import {
  Group,
  School,
  Verified,
  Download,
  BookOpen,
  ArrowUp,
  MoreHorizontal,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  AdminPageHeader,
  AdminStatCard,
  Avi,
  TableShell,
  TableTh,
  TableTd,
} from "@/components/admin/admin-ui";

interface DashboardCounts {
  totalUsers: number;
  totalStudents: number;
  totalInstructors: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  totalCertificates: number;
  pendingReports: number;
}

interface DashboardStats {
  counts: DashboardCounts;
  trends: {
    users: number;
    courses: number;
    enrollments: number;
    certificates: number;
  };
  recentUsers: Array<{
    id: string;
    username: string;
    email: string;
    role: string;
    isBanned: boolean;
    createdAt: Date | string;
  }>;
  popularCourses: Array<{
    id: string;
    slug: string;
    title: string;
    studentCount: number;
    rating: number;
  }>;
}

interface EnrollmentGrowthPoint {
  month: string;
  count: number;
}

interface RevenueGrowthPoint {
  month: string;
  revenue: number;
}

interface RecentEnrollment {
  id: string;
  createdAt: string;
  user: { id: string; username: string; email: string };
  course: { id: string; title: string; slug: string };
}

interface TopCourse {
  id: string;
  slug: string;
  title: string;
  price: number;
  studentCount: number;
  rating: number;
  category: { name: string } | null;
  revenue: number;
  growth: number;
}

interface AdminDashboardClientProps {
  initialStats: DashboardStats;
}

const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
  },
};

function formatRevenue(value: number): string {
  if (value <= 0) return "$0";
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function AdminDashboardClient({ initialStats }: AdminDashboardClientProps) {
  const [enrollmentGrowth, setEnrollmentGrowth] = useState<EnrollmentGrowthPoint[]>([]);
  const [revenueGrowth, setRevenueGrowth] = useState<RevenueGrowthPoint[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<RecentEnrollment[]>([]);
  const [topCourses, setTopCourses] = useState<TopCourse[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(true);

  useEffect(() => {
    async function fetchChartData() {
      try {
        const [growthRes, revenueRes, enrollmentsRes, topCoursesRes] = await Promise.all([
          apiFetch<EnrollmentGrowthPoint[]>("/api/staff/stats/enrollment-growth?months=6"),
          apiFetch<RevenueGrowthPoint[]>("/api/staff/stats/revenue-growth?months=6"),
          apiFetch<{ items: RecentEnrollment[] }>("/api/staff/enrollments?page=1&pageSize=5"),
          apiFetch<TopCourse[]>("/api/staff/stats/top-courses?limit=5"),
        ]);
        setEnrollmentGrowth(growthRes);
        setRevenueGrowth(revenueRes);
        setRecentEnrollments(enrollmentsRes.items);
        setTopCourses(topCoursesRes);
      } catch (err) {
        console.error("Failed to fetch chart data:", err);
      } finally {
        setLoadingCharts(false);
      }
    }
    fetchChartData();
  }, []);

  const counts = initialStats.counts;
  const trends = initialStats.trends;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        subtitle="Platform overview and recent activity."
      >
        <Button variant="outline" className="gap-2">
          <Download className="size-4" />
          Export Report
        </Button>
      </AdminPageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Total Users"
          value={counts.totalUsers.toLocaleString()}
          icon={Group}
          color="from-indigo-500 to-violet-600"
          trend={trends.users}
        />
        <AdminStatCard
          label="Active Courses"
          value={counts.publishedCourses.toLocaleString()}
          sub={`${counts.totalCourses.toLocaleString()} total`}
          icon={BookOpen}
          color="from-cyan-500 to-blue-500"
          trend={trends.courses}
        />
        <AdminStatCard
          label="Total Enrollments"
          value={counts.totalEnrollments.toLocaleString()}
          icon={School}
          color="from-emerald-500 to-teal-600"
          trend={trends.enrollments}
        />
        <AdminStatCard
          label="Certificates Issued"
          value={counts.totalCertificates.toLocaleString()}
          icon={Verified}
          color="from-amber-400 to-orange-500"
          trend={trends.certificates}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Enrollment Growth{" "}
            <span className="text-xs font-normal text-muted-foreground">
              · Last 6 months
            </span>
          </h3>
          <div className="h-[160px] w-full">
            {loadingCharts ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Loading chart…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={enrollmentGrowth} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="agEnroll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip {...chartTooltip} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#agEnroll)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Revenue{" "}
            <span className="text-xs font-normal text-muted-foreground">
              · Last 6 months
            </span>
          </h3>
          <div className="h-[160px] w-full">
            {loadingCharts ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Loading chart…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueGrowth} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip {...chartTooltip} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TableShell>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">Top Performing Courses</h3>
            <Link href="/staff/courses" className="text-xs font-semibold text-primary">
              View all
            </Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <TableTh className="text-left">Course</TableTh>
                <TableTh className="text-right">Students</TableTh>
                <TableTh className="text-right">Revenue</TableTh>
                <TableTh className="text-right">Rating</TableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {topCourses.length === 0 ? (
                <tr>
                  <TableTd colSpan={4} className="py-8 text-center text-muted-foreground">
                    {loadingCharts ? "Loading…" : "No course data"}
                  </TableTd>
                </tr>
              ) : (
                topCourses.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-muted/30">
                    <TableTd className="font-medium">{c.title}</TableTd>
                    <TableTd className="font-mono text-right">{c.studentCount.toLocaleString()}</TableTd>
                    <TableTd className="font-mono text-right font-semibold text-emerald-500">
                      {formatRevenue(c.revenue)}
                    </TableTd>
                    <TableTd className="font-mono text-right font-semibold text-amber-500">
                      {c.rating}★
                    </TableTd>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">Recent Signups</h3>
            <Link href="/staff/users" className="text-xs font-semibold text-primary">
              Manage
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {initialStats.recentUsers.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No recent signups</p>
            ) : (
              initialStats.recentUsers.slice(0, 5).map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
                  <Avi name={u.username} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{u.username}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <MoreHorizontal className="size-4 flex-shrink-0 text-muted-foreground" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <TableShell>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Recent Enrollments</h3>
          <Link href="/staff/enrollments" className="text-xs font-semibold text-primary">
            View all
          </Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <TableTh>Student</TableTh>
              <TableTh>Course</TableTh>
              <TableTh>Enrolled</TableTh>
              <TableTh>Status</TableTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {recentEnrollments.length === 0 ? (
              <tr>
                <TableTd colSpan={4} className="py-8 text-center text-muted-foreground">
                  {loadingCharts ? "Loading…" : "No recent enrollments"}
                </TableTd>
              </tr>
            ) : (
              recentEnrollments.map((e) => (
                <tr key={e.id} className="transition-colors hover:bg-muted/30">
                  <TableTd>
                    <div className="flex items-center gap-2.5">
                      <Avi name={e.user.username} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{e.user.username}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.user.email}</p>
                      </div>
                    </div>
                  </TableTd>
                  <TableTd className="max-w-[180px] truncate text-muted-foreground">
                    {e.course.title}
                  </TableTd>
                  <TableTd className="font-mono text-muted-foreground">
                    {new Date(e.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </TableTd>
                  <TableTd>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                      <ArrowUp className="size-3" />
                      Active
                    </span>
                  </TableTd>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}
