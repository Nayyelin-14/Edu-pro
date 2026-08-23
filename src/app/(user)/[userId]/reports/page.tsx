"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { CheckCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [issueType, setIssueType] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
        body: JSON.stringify({
          courseId,
          reason: issueType,
          details: details || undefined,
        }),
      });
      setCourseId(initialCourseId);
      setIssueType("");
      setDetails("");
      setSubmitted(true);
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* New report form */}
        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-title-lg font-bold text-on-surface">
            {t.reports.newReport}
          </h2>
          {submitted ? (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto mb-3 size-12 text-success" />
              <p className="mb-1 font-semibold text-on-surface">
                {t.reports.submittedTitle}
              </p>
              <p className="mb-4 text-body-md text-on-surface-variant">
                {t.reports.submittedDescription}
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="text-label-md font-medium text-primary hover:underline"
              >
                {t.reports.submitAnother}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="course" className="text-label-md">
                  {t.reports.courseLabel}
                </Label>
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
              <div className="space-y-1.5">
                <Label htmlFor="issueType" className="text-label-md">
                  {t.reports.issueType}
                </Label>
                <Select
                  id="issueType"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    {t.reports.selectIssueType}
                  </option>
                  {t.reports.issueTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="details" className="text-label-md">
                  {t.reports.descriptionLabel}
                </Label>
                <Textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  maxLength={3000}
                  placeholder={t.reports.descriptionPlaceholder}
                />
              </div>
              {error && <Alert variant="error">{error}</Alert>}
              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? t.reports.submitting : t.reports.submit}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* My reports */}
        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm">
          <h2 className="mb-4 text-title-lg font-bold text-on-surface">
            {t.reports.myReports}
          </h2>
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
                <li key={r.id} className="rounded-xl bg-surface-container-low p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-label-sm font-semibold text-on-surface">
                      {r.course.title}
                    </p>
                    <StatusBadge
                      status={r.status}
                      label={statusLabel(r.status)}
                      variant={statusToVariant(r.status)}
                      className="shrink-0"
                    />
                  </div>
                  <p className="mb-1 line-clamp-2 text-label-sm text-on-surface-variant">
                    {r.reason}
                  </p>
                  <p className="font-mono text-[10px] text-on-surface-variant/70">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
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