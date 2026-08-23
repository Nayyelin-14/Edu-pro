"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Route, X } from "lucide-react";
import {
  RoadmapForm,
  type GeneratedRoadmapInfo,
} from "@/components/roadmap/roadmap-form";
import { DraftBanner } from "@/components/roadmap/draft-banner";
import { useDiscardRoadmap, useRoadmaps } from "@/hooks/use-roadmaps";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/user/status-badge";
import { EmptyState } from "@/components/user/empty-state";
import { PageHeader } from "@/components/user/page-header";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n";

export default function RoadmapPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const userId = params.userId as string;
  const { data, isLoading, error, refetch } = useRoadmaps();
  const { mutate: discardRoadmap, isPending: discarding } = useDiscardRoadmap();
  const roadmaps = data?.roadmaps;
  const pendingDraft = data?.pendingDraft;

  const handleGenerated = (roadmap: GeneratedRoadmapInfo) => {
    router.push(`/${userId}/roadmap/${roadmap.id}`);
  };

  const handleDiscardDraft = (id: string) => {
    discardRoadmap(id, {
      onSuccess: () => {
        toast(t.roadmap.deleted, "success");
        void refetch();
      },
      onError: (err) =>
        toast(err instanceof Error ? err.message : t.common.error, "error"),
    });
  };

  const statusFor = (r: {
    progressPercent: number;
    status?: string;
    saved?: boolean;
  }) => {
    if (r.status === "COMPLETED" || r.progressPercent === 100)
      return {
        label: t.roadmap.statusCompleted,
        variant: "success" as const,
        code: "COMPLETED" as const,
      };
    if (r.status === "ACTIVE" || r.progressPercent > 0)
      return {
        label: t.roadmap.statusInProgress,
        variant: "primary" as const,
        code: "IN_PROGRESS" as const,
      };
    if (r.status === "DRAFT" || !r.saved)
      return {
        label: t.roadmap.statusDraft,
        variant: "warning" as const,
        code: "DRAFT" as const,
      };
    return {
      label: t.roadmap.statusNotStarted,
      variant: "neutral" as const,
      code: "NOT_STARTED" as const,
    };
  };

  const coverageVariant = (
    c: string,
  ): "success" | "info" | "warning" | "secondary" => {
    switch (c) {
      case "COMPLETE":
        return "success";
      case "PARTIAL":
        return "info";
      case "WEAK":
        return "warning";
      default:
        return "secondary";
    }
  };
  const coverageLabel = (c: string): string => {
    switch (c) {
      case "COMPLETE":
        return t.roadmap.coverageComplete;
      case "PARTIAL":
        return t.roadmap.coveragePartial;
      case "WEAK":
        return t.roadmap.coverageWeak;
      default:
        return t.roadmap.coverageUnavailable;
    }
  };

  const qualityVariant = (
    q: string,
  ): "success" | "info" | "warning" | "secondary" => {
    switch (q) {
      case "excellent":
        return "success";
      case "good":
        return "info";
      case "partial":
        return "warning";
      default:
        return "secondary";
    }
  };
  const qualityLabel = (q: string): string => {
    switch (q) {
      case "excellent":
        return t.roadmap.qualityExcellent;
      case "good":
        return t.roadmap.qualityGood;
      case "partial":
        return t.roadmap.qualityPartial;
      default:
        return t.roadmap.qualityPoor;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.roadmap.createSubtitle}
        title={t.roadmap.myRoadmaps}
      />

      {/* Pending draft notice */}
      {pendingDraft && (
        <DraftBanner
          title={t.roadmap.draftTitle}
          description={t.roadmap.draftNotice}
          subtitle={`${pendingDraft.title} · ${pendingDraft.goal}`}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDiscardDraft(pendingDraft.id)}
            disabled={discarding}
          >
            <X className="size-4" aria-hidden="true" />
            {t.roadmap.discardDraft}
          </Button>
          <Button size="sm" asChild className="gap-1.5">
            <Link href={`/${userId}/roadmap/${pendingDraft.id}`}>
              {t.roadmap.continueReviewing}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </DraftBanner>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Generator */}
        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm lg:col-span-2">
          <RoadmapForm onGenerated={handleGenerated} />
        </div>

        {/* Saved roadmaps */}
        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm">
          <h2 className="mb-4 text-title-lg font-bold text-on-surface">
            {t.roadmap.savedRoadmaps}
          </h2>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <EmptyState
              icon={<Route className="size-6" />}
              title={t.common.error}
              className="border-0 px-2 py-8"
              action={
                <Button onClick={() => void refetch()}>{t.common.retry}</Button>
              }
            />
          ) : !roadmaps || roadmaps.length === 0 ? (
            <EmptyState
              icon={<Route className="size-6" />}
              title={t.roadmap.noRoadmapsYet}
              description={t.roadmap.noRoadmapsSubtitle}
              className="border-0 px-2 py-8"
            />
          ) : (
            <ul className="space-y-3">
              {roadmaps.map((r) => {
                const status = statusFor(r);
                return (
                  <li key={r.id}>
                    <Link
                      href={`/${userId}/roadmap/${r.id}`}
                      className="block rounded-xl bg-surface-container-low p-3 transition-colors hover:bg-surface-container"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-label-sm font-semibold text-on-surface">
                          {r.title}
                        </p>
                        <StatusBadge
                          status={status.code}
                          label={status.label}
                          variant={status.variant}
                          className="shrink-0"
                        />
                      </div>
                      <p className="mb-2 line-clamp-1 text-label-sm text-on-surface-variant">
                        {r.goal}
                      </p>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <Badge variant={coverageVariant(r.catalogCoverage)}>
                          {coverageLabel(r.catalogCoverage)}
                        </Badge>
                        <Badge variant={qualityVariant(r.roadmapQuality)}>
                          {qualityLabel(r.roadmapQuality)}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {r.level}
                        </Badge>
                      </div>
                      <div className="flex gap-3 font-mono text-label-sm text-on-surface-variant">
                        <span>
                          {r.matchedStages} {t.roadmap.courses}
                        </span>
                        <span>
                          {r.estimatedDuration || r.durationWeeks}{" "}
                          {t.roadmap.weeks}
                        </span>
                        <span>{r.progressPercent}%</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
