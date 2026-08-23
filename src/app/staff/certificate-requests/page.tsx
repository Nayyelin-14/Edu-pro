"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CheckCircle2, Mail, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

interface CertificateRequest {
  id: string;
  status: RequestStatus;
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
  user: {
    id: string;
    username: string;
    email: string;
    avatar: string | null;
  };
  course: {
    id: string;
    title: string;
    slug: string;
    instructorId: string | null;
  };
  testResult: {
    id: string;
    score: number;
    total: number;
    percent: number;
    passed: boolean;
    submittedAt: string;
    timeTakenSeconds: number;
  } | null;
}

interface ListResponse {
  items: CertificateRequest[];
}

const FILTERS: Array<{ key: RequestStatus | "ALL"; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

function StatusBadge({ status }: { status: RequestStatus }) {
  const styles =
    status === "PENDING"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      : status === "APPROVED"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
        : "bg-destructive/10 text-destructive";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles,
      )}
    >
      {status === "PENDING" && <XCircle className="size-3" />}
      {status === "APPROVED" && <CheckCircle2 className="size-3" />}
      {status === "REJECTED" && <XCircle className="size-3" />}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function StaffCertificateRequestsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [filter, setFilter] = useState<RequestStatus | "ALL">("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["staff-certificate-requests"],
    queryFn: () =>
      apiFetch<ListResponse>("/api/staff/certificate-requests"),
  });

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return filter === "ALL" ? all : all.filter((r) => r.status === filter);
  }, [data, filter]);

  const canDecide = (r: CertificateRequest) =>
    user?.id && r.course.instructorId === user.id;

  const decide = async (id: string, action: "APPROVE" | "REJECT") => {
    try {
      await apiFetch(`/api/staff/certificate-requests/${id}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      toast(
        action === "APPROVE"
          ? "Certificate issued to the student"
          : "Request declined",
        "success",
      );
      void qc.invalidateQueries({ queryKey: ["staff-certificate-requests"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Certificate requests"
        subtitle="Students who passed the final test and requested a certificate."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Award className="mx-auto size-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            No certificate requests
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            When a student passes your final test and requests a certificate,
            it will appear here for you to review.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="divide-y divide-border/40">
            {items.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                      {r.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.user.avatar}
                          alt={r.user.username}
                          className="size-full object-cover"
                        />
                      ) : (
                        <UserRound className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {r.user.username}
                        </p>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="size-3" />
                        {r.user.email}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-foreground/80">
                        {r.course.title}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {r.testResult ? (
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {r.testResult.score}/{r.testResult.total} (
                          {r.testResult.percent}%)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submitted{" "}
                          {new Date(r.testResult.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <Badge variant="secondary">No test result</Badge>
                    )}

                    {r.status === "PENDING" ? (
                      canDecide(r) ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => void decide(r.id, "APPROVE")}
                          >
                            <CheckCircle2 className="size-4" />
                            Issue
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => void decide(r.id, "REJECT")}
                          >
                            <XCircle className="size-4" />
                            Decline
                          </Button>
                        </div>
                      ) : (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ShieldCheck className="size-3.5" />
                          Only the course instructor can decide
                        </p>
                      )
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Decided{" "}
                        {r.decidedAt
                          ? new Date(r.decidedAt).toLocaleDateString()
                          : "—"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}