"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

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

export default function AdminReportsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports", status, page],
    queryFn: () =>
      apiFetch<ReportsResponse>(
        `/api/admin/reports?status=${status}&page=${page}&pageSize=20`,
      ),
  });

  const resolve = async (id: string, newStatus: "RESOLVED" | "DISMISSED") => {
    try {
      await apiFetch(`/api/admin/reports/${id}`, {
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
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <select
        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
      >
        <option value="ALL">All</option>
        <option value="PENDING">Pending</option>
        <option value="RESOLVED">Resolved</option>
        <option value="DISMISSED">Dismissed</option>
      </select>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.map((r) => (
                <div key={r.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{r.course.title}</p>
                    <Badge
                      variant={
                        r.status === "PENDING"
                          ? "warning"
                          : r.status === "RESOLVED"
                            ? "success"
                            : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-sm">{r.reason}</p>
                  {r.details && (
                    <p className="text-sm text-muted-foreground">{r.details}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Reported by {r.reporter.username} ·{" "}
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                  {r.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => void resolve(r.id, "RESOLVED")}>
                        Resolve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void resolve(r.id, "DISMISSED")}>
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="flex items-center px-2 text-sm text-muted-foreground">
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
