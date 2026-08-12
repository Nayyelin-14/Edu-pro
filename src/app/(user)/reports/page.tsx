"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  course: { id: string; title: string; slug: string };
}

interface CourseOption {
  id: string;
  title: string;
}

function ReportsInner() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { toast } = useToast();
  const initialCourseId = searchParams.get("courseId") ?? "";

  const [courseId, setCourseId] = useState(initialCourseId);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reportsQuery = useQuery({
    queryKey: ["my-reports"],
    queryFn: () => apiFetch<{ reports: Report[] }>("/api/reports"),
  });

  const coursesQuery = useQuery({
    queryKey: ["course-options"],
    queryFn: () =>
      apiFetch<{ items: CourseOption[] }>("/api/courses?pageSize=100"),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({ courseId, reason, details: details || undefined }),
      });
      setReason("");
      setDetails("");
      toast("Report submitted", "success");
      void qc.invalidateQueries({ queryKey: ["my-reports"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const reports = reportsQuery.data?.reports ?? [];
  const courses = coursesQuery.data?.items ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-1 text-muted-foreground">
          Report a course you believe violates our guidelines.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New report</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <select
                id="course"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a course
                </option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                maxLength={120}
                placeholder="e.g. Outdated content, offensive material…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="details">Details (optional)</Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={3000}
              />
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting…" : "Submit report"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My reports</CardTitle>
        </CardHeader>
        <CardContent>
          {reportsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports submitted.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{r.course.title}</p>
                    <p className="text-sm text-muted-foreground">{r.reason}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsInner />
    </Suspense>
  );
}
