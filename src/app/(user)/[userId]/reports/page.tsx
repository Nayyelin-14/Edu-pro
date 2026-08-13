"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Flag, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/user/page-header";
import { EmptyState } from "@/components/user/empty-state";
import { StatusBadge, statusToVariant } from "@/components/user/status-badge";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/i18n";

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
  const { t } = useI18n();
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
      toast(t.reports.reportSubmitted, "success");
      void qc.invalidateQueries({ queryKey: ["my-reports"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const reports = reportsQuery.data?.reports ?? [];
  const courses = coursesQuery.data?.items ?? [];

  const statusLabel = (status: string) =>
    status === "PENDING"
      ? t.reports.statusPending
      : status === "RESOLVED"
        ? t.reports.statusResolved
        : status === "DISMISSED"
          ? t.reports.statusDismissed
          : status.toLowerCase();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.nav.reports}
        title={t.reports.title}
        subtitle={t.reports.subtitle}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* New report form */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="size-4 text-primary" />
              {t.reports.newReport}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="course">{t.reports.courseLabel}</Label>
                <Select
                  id="course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    {t.reports.selectCourse}
                  </option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">{t.reports.reasonLabel}</Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  maxLength={120}
                  placeholder={t.reports.reasonPlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="details">{t.reports.detailsLabel}</Label>
                <Textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={3000}
                />
              </div>
              {error && <Alert variant="error">{error}</Alert>}
              <Button type="submit" disabled={loading}>
                {loading ? t.reports.submitting : t.reports.submit}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My reports */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>{t.reports.myReports}</CardTitle>
          </CardHeader>
          <CardContent>
            {reportsQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : reports.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-6" />}
                title={t.reports.noReports}
                className="border-0 py-10"
              />
            ) : (
              <ul className="space-y-3">
                {reports.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-medium text-on-surface">
                          {r.course.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-label-sm text-on-surface-variant">
                          {r.reason}
                        </p>
                      </div>
                      <StatusBadge
                        status={r.status}
                        label={statusLabel(r.status)}
                        variant={statusToVariant(r.status)}
                        className="shrink-0"
                      />
                    </div>
                    <p className="mt-2 text-label-sm text-muted-foreground">
                      {t.reports.submittedOn(new Date(r.createdAt).toLocaleDateString())}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
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