"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Group,
  DollarSign,
  School,
  Verified,
  TrendingUp,
  TrendingDown,
  Download,
  Plus,
  ArrowUp,
  BookOpen,
  Minus,
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
  Legend,
} from "recharts";

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

interface RevenueByCategoryPoint {
  category: string;
  revenue: number;
  percentage: number;
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

export function AdminDashboardClient({ initialStats }: AdminDashboardClientProps) {
  const [enrollmentGrowth, setEnrollmentGrowth] = useState<EnrollmentGrowthPoint[]>([]);
  const [revenueByCategory, setRevenueByCategory] = useState<RevenueByCategoryPoint[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<RecentEnrollment[]>([]);
  const [topCourses, setTopCourses] = useState<TopCourse[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(true);

  useEffect(() => {
    async function fetchChartData() {
      try {
        const [growthRes, revenueRes, enrollmentsRes, topCoursesRes] = await Promise.all([
          apiFetch<EnrollmentGrowthPoint[]>("/api/admin/stats/enrollment-growth?months=6"),
          apiFetch<RevenueByCategoryPoint[]>("/api/admin/stats/revenue-by-category"),
          apiFetch<{ items: RecentEnrollment[] }>("/api/admin/enrollments?page=1&pageSize=5"),
          apiFetch<TopCourse[]>("/api/admin/stats/top-courses?limit=3"),
        ]);
        setEnrollmentGrowth(growthRes);
        setRevenueByCategory(revenueRes);
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

  const kpiCards = [
    {
      label: "Total Users",
      value: counts.totalUsers.toLocaleString(),
      icon: Group,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      trend: { value: "+12.5%", positive: true },
    },
    {
      label: "Total Revenue (YTD)",
      value: "$1.2M",
      icon: DollarSign,
      iconBg: "bg-secondary/30",
      iconColor: "text-secondary",
      trend: { value: "+8.2%", positive: true },
    },
    {
      label: "Active Enrollments",
      value: counts.totalEnrollments.toLocaleString(),
      icon: School,
      iconBg: "bg-accent",
      iconColor: "text-accent-foreground",
      trend: { value: "+15.3%", positive: true },
    },
    {
      label: "Avg Completion Rate",
      value: "68%",
      icon: Verified,
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
      trend: { value: "-2.1%", positive: false },
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            High-level metrics and recent platform activity.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="size-4" />
            Export Report
          </Button>
          <Button className="gap-2">
            <Plus className="size-4" />
            Create Course
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-6 flex flex-col justify-between border-border/50 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${card.iconBg}`}>
                  <Icon className={`size-6 ${card.iconColor}`} />
                </div>
                <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                  {card.trend.positive ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {card.trend.value}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-foreground">{card.value}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6 border-border/50 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-foreground">Enrollment Growth</h3>
            <select className="bg-accent border-border rounded-md text-xs px-3 py-1 outline-none focus:ring-1 focus:ring-primary">
              <option>Last 6 Months</option>
              <option>This Year</option>
              <option>All Time</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            {loadingCharts ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Loading chart...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={enrollmentGrowth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEnrollments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    fill="url(#colorEnrollments)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--primary))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6 flex flex-col border-border/50 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-6">Revenue by Category</h3>
          <div className="flex-1 flex flex-col justify-center gap-4">
            {loadingCharts ? (
              <div className="space-y-4">
                <div className="h-8 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-8 bg-muted animate-pulse rounded w-1/2" />
                <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
                <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
              </div>
            ) : (
              revenueByCategory.map((item, index) => (
                <div key={item.category}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-foreground">{item.category}</span>
                    <span className="text-muted-foreground">{item.percentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden flex flex-col border-border/50 shadow-sm">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h3 className="text-lg font-semibold text-foreground">Recent Enrollments</h3>
            <Link href="/admin/enrollments" className="text-primary text-sm font-medium hover:underline">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-accent/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Course</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentEnrollments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                      {loadingCharts ? "Loading..." : "No recent enrollments"}
                    </td>
                  </tr>
                ) : (
                  recentEnrollments.map((e) => (
                    <tr key={e.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{e.user.username}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{e.course.title}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(e.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="default" className="bg-primary/10 text-primary">
                          Active
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden flex flex-col border-border/50 shadow-sm">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h3 className="text-lg font-semibold text-foreground">Top Performing Courses</h3>
            <Link href="/admin/reports" className="text-primary text-sm font-medium hover:underline">
              View Reports
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-border p-2 flex-1">
            {topCourses.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                {loadingCharts ? "Loading..." : "No course data"}
              </div>
            ) : (
              topCourses.map((course) => (
                <Link
                  key={course.id}
                  href={`/admin/courses/${course.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-accent/50 rounded-lg transition-colors"
                >
                  <div className="w-16 h-12 bg-muted rounded border border-border flex items-center justify-center">
                    <BookOpen className="size-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">{course.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {course.studentCount.toLocaleString()} enrolled &bull; {course.rating} avg rating
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      ${(course.revenue / 1000).toFixed(0)}k
                    </p>
                    <p className="text-xs flex items-center justify-end gap-1 text-green-600">
                      <ArrowUp className="size-3" />
                      {course.growth}%
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}