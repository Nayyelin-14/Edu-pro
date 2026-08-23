"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, GraduationCap, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import {
  AdminPageHeader,
  AdminStatCard,
  Avi,
  FilterPills,
  ProgressBar,
  StatusBadge,
  TableShell,
  TableTh,
  TableTd,
} from "@/components/admin/admin-ui";

export interface Enrollment {
  id: string;
  createdAt: string;
  user: { id: string; username: string; email: string };
  course: {
    id: string;
    title: string;
    slug: string;
    category: { id: string; name: string } | null;
  };
  progress: { completedLessons: number; totalLessons: number; percent: number };
}

interface EnrollmentsResponse {
  items: Enrollment[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "dropped", label: "Dropped" },
];

export default function AdminEnrollmentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-enrollments", page, search, status],
    queryFn: () =>
      apiFetch<EnrollmentsResponse>(
        `/api/staff/enrollments?page=${page}&pageSize=20${
          search ? `&search=${encodeURIComponent(search)}` : ""
        }${status !== "all" ? `&status=${status}` : ""}`,
      ),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const avgCompletion = items.length
    ? Math.round(items.reduce((s, e) => s + e.progress.percent, 0) / items.length)
    : 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Enrollment Management"
        subtitle="Audit and track student enrollment progress across all active courses."
      >
        <Button variant="outline" className="gap-2">
          <Timer className="size-4" />
          Export CSV
        </Button>
      </AdminPageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard
          label="Total Enrollments"
          value={total.toLocaleString()}
          icon={BookOpen}
          color="from-indigo-500 to-violet-600"
          trend={12}
        />
        <AdminStatCard
          label="New This Month"
          value="342"
          icon={GraduationCap}
          color="from-cyan-500 to-blue-500"
          sub="Last 30 days"
        />
        <AdminStatCard
          label="Avg. Completion"
          value={`${avgCompletion}%`}
          icon={Timer}
          color="from-emerald-500 to-teal-600"
          progress={avgCompletion}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by student or course..."
            className="w-64 rounded-xl border-0 bg-muted py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <FilterPills
          options={STATUS_FILTERS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ) : (
        <TableShell>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <TableTh>Student</TableTh>
                <TableTh>Course</TableTh>
                <TableTh>Enrolled</TableTh>
                <TableTh>Progress</TableTh>
                <TableTh className="text-right">Status</TableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.length === 0 ? (
                <tr>
                  <TableTd colSpan={5} className="py-12 text-center text-muted-foreground">
                    No enrollments found.
                  </TableTd>
                </tr>
              ) : (
                items.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-muted/20">
                    <TableTd>
                      <div className="flex items-center gap-2.5">
                        <Avi name={e.user.username} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{e.user.username}</p>
                          <p className="truncate text-xs text-muted-foreground">{e.user.email}</p>
                        </div>
                      </div>
                    </TableTd>
                    <TableTd className="max-w-[200px]">
                      <p className="truncate font-medium text-foreground">{e.course.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.course.category?.name ?? "General"}
                      </p>
                    </TableTd>
                    <TableTd className="font-mono text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </TableTd>
                    <TableTd>
                      <div className="flex w-40 items-center gap-2">
                        <ProgressBar value={e.progress.percent} />
                        <span className="font-mono text-xs text-muted-foreground">
                          {e.progress.percent}%
                        </span>
                      </div>
                    </TableTd>
                    <TableTd className="text-right">
                      <StatusBadge status={e.progress.percent > 0 ? "ACTIVE" : "PENDING"} />
                    </TableTd>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, page - 2), Math.min(totalPages, page + 2))
              .map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
