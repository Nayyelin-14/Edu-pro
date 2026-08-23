"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Award, Clock3, FileDown, Share2, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/user/empty-state";
import { PageHeader } from "@/components/user/page-header";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n";

interface Certificate {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  pdfUrl: string | null;
  course: { id: string; title: string; slug: string };
}

interface CertRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  course: { id: string; title: string; slug: string };
}

export function CertificatesPanel() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () =>
      apiFetch<{ certificates: Certificate[] }>("/api/me/certificates"),
  });

  const { data: requests } = useQuery({
    queryKey: ["my-certificate-requests"],
    queryFn: () =>
      apiFetch<{ items: CertRequest[] }>("/api/me/certificate-requests"),
  });

  const certificates = data?.certificates ?? [];
  const pendingRequests = requests?.items.filter(
    (r) => r.status === "PENDING",
  ) ?? [];

  const handleShare = async (cert: Certificate) => {
    const url = `${window.location.origin}/certificates/verify?number=${cert.certificateNumber}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: cert.course.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied", "success");
    } catch {
      // User cancelled share.
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.nav.certificates}
        title={t.nav.certificates}
        subtitle={t.certificates.subtitle ?? "Your earned credentials — view, download, or verify."}
        actions={<Badge variant="warning">{t.certificates.count(certificates.length)}</Badge>}
      />

      {pendingRequests.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-400/10 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <Clock3 className="size-4 text-amber-600" />
            Certificate requests pending review
          </h3>
          <ul className="mt-3 space-y-2">
            {pendingRequests.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-surface-container-lowest px-4 py-3 text-sm"
              >
                <span className="font-medium text-on-surface">{r.course.title}</span>
                <span className="text-label-sm text-on-surface-variant">
                  Requested {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-label-sm text-on-surface-variant">
            The instructor reviews your score and will approve or decline your
            request. You&apos;ll be notified when a decision is made.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-outline-variant">
              <Skeleton className="h-24 w-full" />
              <div className="space-y-4 p-5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="mt-6 flex gap-2">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<Award className="size-7" />}
          title={t.common.error}
          description={t.common.error}
          action={
            <button
              onClick={() => void refetch()}
              className="text-label-md font-medium text-primary hover:underline"
            >
              Retry
            </button>
          }
        />
      ) : certificates.length === 0 ? (
        <EmptyState
          icon={<Award className="size-7" />}
          title={t.certificates.emptyTitle}
          description={t.certificates.emptyDescription}
          action={
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-label-md font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t.dashboard.browseCourses}
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-lowest shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10"
            >
              {/* Amber header */}
              <div className="flex items-center gap-4 border-b border-outline-variant bg-gradient-to-br from-amber-400/20 to-orange-400/20 p-5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20">
                  <Award className="size-7 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-on-surface">{cert.course.title}</p>
                  <p className="mt-0.5 text-label-sm text-on-surface-variant">
                    {t.certificates.completed}
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-label-sm text-on-surface-variant">
                    {t.certificates.issued}:{" "}
                    <span className="font-medium text-on-surface">
                      {new Date(cert.issuedAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="truncate font-mono text-label-sm text-primary">
                    {cert.certificateNumber}
                  </span>
                </div>

                <div className="mt-auto flex gap-2">
                  <Link
                    href={cert.pdfUrl || `/certificates/verify?number=${cert.certificateNumber}`}
                    target={cert.pdfUrl ? "_blank" : undefined}
                    rel={cert.pdfUrl ? "noreferrer" : undefined}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-outline-variant text-label-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                  >
                    <FileDown className="size-3.5" />
                    {t.certificates.download}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleShare(cert)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-outline-variant text-label-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                  >
                    <Share2 className="size-3.5" />
                    {t.certificates.share}
                  </button>
                  <Link
                    href={`/certificates/verify?number=${cert.certificateNumber}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 text-label-sm font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <ShieldCheck className="size-3.5" />
                    {t.certificates.verify}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}