"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";

interface Enrollment {
  id: string;
  createdAt: string;
  user: { id: string; username: string; email: string };
  course: { id: string; title: string; slug: string; category: { id: string; name: string } | null };
  progress: { completedLessons: number; totalLessons: number; percent: number };
}

interface EnrollmentsResponse {
  items: Enrollment[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminEnrollmentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | "active" | "completed" | "dropped">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-enrollments", page, search, status],
    queryFn: () =>
      apiFetch<EnrollmentsResponse>(
        `/api/admin/enrollments?page=${page}&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ""}${status !== "all" ? `&status=${status}` : ""}`,
      ),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-stack-lg">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md">
        <div>
          <h2 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg-mobile md:font-headline-lg text-on-surface">
            Enrollment Management
          </h2>
          <p className="text-body-md font-body-md text-on-surface-variant mt-1">
            Audit and track student enrollment progress across all active courses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </Button>
          <Button className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Manual Enroll
          </Button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <StatCard
          label="Total Active"
          value="1,248"
          trend={{ value: "+12%", label: "this month", positive: true }}
          icon="monitoring"
          iconBg="secondary-container"
          iconColor="on-secondary-fixed-variant"
        />
        <StatCard
          label="New This Month"
          value="342"
          trend={{ value: "Last 30 days" }}
          icon="group_add"
          iconBg="tertiary-fixed"
          iconColor="on-tertiary-fixed"
        />
        <StatCard
          label="Avg. Completion"
          value="68%"
          progress={68}
          icon="done_all"
          iconBg="primary-fixed"
          iconColor="on-primary-fixed"
        />
      </div>

      {/* Table Section */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl flex flex-col">
        {/* Toolbar */}
        <div className="p-stack-md border-b border-outline-variant flex flex-col md:flex-row gap-stack-md justify-between items-center bg-surface-bright rounded-t-xl">
          <div className="relative w-full md:w-96">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student or course..."
              className="pl-10 pr-4 py-2"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
<select
            value={status}
            onChange={(e) => { setStatus(e.target.value as "all" | "active" | "completed" | "dropped"); setPage(1); }}
            className="flex-1 md:flex-none border border-outline-variant rounded-lg bg-surface-container-lowest px-4 py-2 text-label-md font-label-md focus:outline-none focus:ring-2 focus:ring-primary-container"
          >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </select>
            <Button variant="outline" size="sm" className="md:flex-none">
              <span className="material-symbols-outlined">filter_list</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant font-semibold uppercase tracking-wider w-1/3">Student</th>
                  <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant font-semibold uppercase tracking-wider w-1/4">Course</th>
                  <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">Enrolled</th>
                  <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">Progress</th>
                  <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant font-semibold uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high bg-surface-container-lowest">
                {items.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-bright transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={e.user.username} />
                        <div>
                          <div className="text-label-md font-label-md text-on-surface font-semibold">{e.user.username}</div>
                          <div className="text-label-sm font-label-sm text-on-surface-variant">{e.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-body-md font-body-md text-on-surface">{e.course.title}</div>
                      <div className="text-label-sm font-label-sm text-on-surface-variant">{e.course.category?.name || "General"}</div>
                    </td>
                    <td className="px-6 py-4 text-body-md font-body-md text-on-surface-variant">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden w-24">
                          <div
                            className={`h-full rounded-full ${e.progress.percent === 100 ? "bg-green-500" : "bg-primary-container"}`}
                            style={{ width: `${e.progress.percent}%` }}
                          />
                        </div>
                        <span className="text-label-sm font-label-sm text-on-surface-variant w-8">{e.progress.percent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <StatusBadge progress={e.progress} />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">
                      No enrollments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="p-stack-md border-t border-outline-variant flex items-center justify-between bg-surface-container-lowest rounded-b-xl">
          <span className="text-label-sm font-label-sm text-on-surface-variant">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} entries
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 2), Math.min(totalPages, page + 2)).map((p) => (
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
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, icon, iconBg, iconColor, progress }: {
  label: string;
  value: string;
  trend?: { value: string; label?: string; positive?: boolean };
  icon: string;
  iconBg: string;
  iconColor: string;
  progress?: number;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-lg flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <span className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">{label}</span>
        <div className={`p-2 ${iconBg} rounded-DEFAULT ${iconColor}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
      <div className="text-headline-lg font-headline-lg text-on-surface">{value}</div>
      {progress !== undefined ? (
        <div className="w-full h-2 bg-surface-variant rounded-full mt-1 overflow-hidden">
          <div className="h-full bg-primary-container w-full rounded-full" style={{ width: `${progress}%` }} />
        </div>
      ) : trend && (
        <div className="flex items-center gap-1 text-label-sm font-label-sm">
          {trend.positive && <span className="material-symbols-outlined text-[#10b981] text-[14px]">trending_up</span>}
          <span className={trend.positive ? "text-[#10b981]" : "text-on-surface-variant"}>{trend.value}</span>
          {trend.label && <span>{trend.label}</span>}
        </div>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["bg-tertiary-container text-on-tertiary", "bg-secondary-fixed text-on-secondary-fixed", "bg-primary-container text-on-primary-container", "bg-primary-fixed text-on-primary-fixed"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-label-md font-label-md font-bold ${color}`}>
      {initials}
    </div>
  );
}

function StatusBadge({ progress }: { progress: { percent: number; totalLessons: number } }) {
  if (progress.percent === 100 && progress.totalLessons > 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-label-sm font-label-sm font-medium bg-[#10b981]/10 text-[#059669] border border-[#10b981]/20">
        Completed
      </span>
    );
  }
  if (progress.percent > 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-label-sm font-label-sm font-medium bg-primary-fixed text-on-primary-fixed border border-primary-fixed-dim">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-label-sm font-label-sm font-medium bg-surface-variant text-on-surface-variant border border-outline-variant">
      Not Started
    </span>
  );
}

function TableSkeleton() {
  return (
    <>
      <thead>
        <tr className="bg-surface-container-low border-b border-outline-variant">
          <th className="px-6 py-3"><Skeleton className="h-4 w-24" /></th>
          <th className="px-6 py-3"><Skeleton className="h-4 w-20" /></th>
          <th className="px-6 py-3"><Skeleton className="h-4 w-16" /></th>
          <th className="px-6 py-3"><Skeleton className="h-4 w-16" /></th>
          <th className="px-6 py-3"><Skeleton className="h-4 w-16" /></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-surface-container-high">
        {[1, 2, 3].map((i) => (
          <tr key={i} className="hover:bg-surface-bright transition-colors">
            <td className="px-6 py-4"><Skeleton className="h-8 w-40" /></td>
            <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
            <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
            <td className="px-6 py-4"><Skeleton className="h-2 w-24" /></td>
            <td className="px-6 py-4"><Skeleton className="h-6 w-20" /></td>
          </tr>
        ))}
      </tbody>
    </>
  );
}