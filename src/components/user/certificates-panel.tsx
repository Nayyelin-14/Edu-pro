"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileDown, ShieldCheck, Award } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/user/empty-state";
import { useI18n } from "@/i18n";

interface Certificate {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  pdfUrl: string | null;
  course: { id: string; title: string; slug: string };
}

export function CertificatesPanel() {
  const { t } = useI18n();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: () =>
      apiFetch<{ certificates: Certificate[] }>("/api/me/certificates"),
  });

  const certificates = data?.certificates ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-outline-variant">
            <Skeleton className="h-44 w-full" />
            <div className="space-y-4 p-5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="mt-6 flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="size-10 rounded-lg" />
                <Skeleton className="size-10 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<Award className="size-7" />}
        title={t.common.error}
        description={t.common.error}
        action={
          <button onClick={() => void refetch()} className="text-label-md font-medium text-primary hover:underline">
            Retry
          </button>
        }
      />
    );
  }

  if (certificates.length === 0) {
    return (
      <EmptyState
        icon={<Award className="size-7" />}
        title="No certificates yet"
        description="Complete a course and pass the final test to earn your first certificate."
        action={
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-label-md font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.dashboard.browseCourses}
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {certificates.map((cert) => (
        <div
          key={cert.id}
          className="group flex flex-col overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-lowest transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        >
          {/* Design preview */}
          <div className="relative h-44 overflow-hidden border-b border-outline-variant bg-gradient-to-br from-primary via-primary-fixed-variant to-success">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.6) 0, transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.4) 0, transparent 45%)" }} />
            <div className="relative flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-2xl border border-white/40 bg-white/20 text-white shadow-lg backdrop-blur-md">
                <Award className="size-9" />
              </span>
              <span className="text-label-sm font-semibold uppercase tracking-[0.18em] text-white/90">
                Certificate of Completion
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-5">
            <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-success-container px-2.5 py-1 text-label-sm font-semibold text-on-success-container">
              <ShieldCheck className="size-3.5" />
              Completed
            </span>
            <h3 className="line-clamp-2 text-title-lg font-semibold text-on-surface">
              {cert.course.title}
            </h3>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Issued: {new Date(cert.issuedAt).toLocaleDateString()}
            </p>
            <p className="mt-1 truncate text-label-sm text-outline">
              ID: {cert.certificateNumber}
            </p>

            <div className="mt-auto flex gap-2 pt-5">
              <Link
                href={cert.pdfUrl || `/certificates/verify?number=${cert.certificateNumber}`}
                target={cert.pdfUrl ? "_blank" : undefined}
                rel={cert.pdfUrl ? "noreferrer" : undefined}
                className="flex-1 rounded-xl bg-primary-container px-4 py-2 text-center text-label-md font-semibold text-on-primary-container transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                View
              </Link>
              {cert.pdfUrl && (
                <a
                  href={cert.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                  title="Download"
                >
                  <FileDown className="size-5" />
                </a>
              )}
              <Link
                href={`/certificates/verify?number=${cert.certificateNumber}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                title="Verify"
              >
                <ShieldCheck className="size-5" />
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}