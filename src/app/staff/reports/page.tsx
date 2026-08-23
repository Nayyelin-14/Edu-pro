"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  AdminPageHeader,
  FilterPills,
  StatusBadge,
  TableShell,
  TableTh,
  TableTd,
} from "@/components/admin/admin-ui";

interface AdminReport {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  course: { id: string; title: string; slug: string };
  reporter: { id: string; username: string; email: string };
}

interface ReportsResponse {
  items: AdminReport[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
];

const STATUS_BADGES: Record<string, "ACTIVE" | "PENDING" | "REJECTED"> = {
  RESOLVED: "ACTIVE",
  PENDING: "PENDING",
  DISMISSED: "REJECTED",
};

export default function AdminReportsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports", status, page],
    queryFn: () =>
      apiFetch<ReportsResponse>(
        `/api/staff/reports?status=${status}&page=${page}&pageSize=20`,
      ),
  });

  const resolve = async (id: string, newStatus: "RESOLVED" | "DISMISSED") => {
    try {
      await apiFetch(`/api/staff/reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast("Report updated", "success");
      void qc.invalidateQueries({ queryKey: ["admin-reports"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reports"
        subtitle="Review and manage course reports submitted by users."
      >
        <FilterPills
          options={STATUS_FILTERS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </AdminPageHeader>

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
                <TableTh>Course</TableTh>
                <TableTh>Reason</TableTh>
                <TableTh>Reporter</TableTh>
                <TableTh>Date</TableTh>
                <TableTh>Status</TableTh>
                <TableTh className="text-right">Actions</TableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.length === 0 ? (
                <tr>
                  <TableTd colSpan={6} className="py-12 text-center text-muted-foreground">
                    No reports found.
                  </TableTd>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-muted/20">
                    <TableTd className="max-w-[200px]">
                      <p className="truncate font-medium text-foreground">{r.course.title}</p>
                    </TableTd>
                    <TableTd className="max-w-[220px]">
                      <p className="truncate text-muted-foreground">{r.reason}</p>
                      {r.details && (
                        <p className="truncate text-xs text-muted-foreground/70">{r.details}</p>
                      )}
                    </TableTd>
                    <TableTd className="text-muted-foreground">{r.reporter.username}</TableTd>
                    <TableTd className="font-mono text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </TableTd>
                    <TableTd>
                      <StatusBadge status={STATUS_BADGES[r.status] ?? "PENDING"} />
                    </TableTd>
                    <TableTd>
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-500"
                              onClick={() => void resolve(r.id, "RESOLVED")}
                            >
                              Resolve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground"
                              onClick={() => void resolve(r.id, "DISMISSED")}
                            >
                              Dismiss
                            </Button>
                          </>
                        )}
                      </div>
                    </TableTd>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="flex items-center px-2 font-mono text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
