"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Route } from "lucide-react";
import { RoadmapForm, type GeneratedRoadmapInfo } from "@/components/roadmap/roadmap-form";
import { RoadmapCard } from "@/components/roadmap/roadmap-card";
import { useRoadmaps } from "@/hooks/use-roadmaps";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/user/empty-state";
import { useI18n } from "@/i18n";

export default function RoadmapPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const { data: roadmaps, isLoading, error, refetch } = useRoadmaps();

  const handleGenerated = (roadmap: GeneratedRoadmapInfo) => {
    // Navigate straight to the review page; the generated roadmap is an
    // unsaved draft until the user confirms it there.
    router.push(`/${userId}/roadmap/${roadmap.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 pb-10">
      {/* Generator */}
      <section className="relative">
        <div className="mb-5 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="mb-2 text-label-md font-semibold uppercase tracking-[0.14em] text-primary">
              {t.roadmap.heroSubtitle}
            </p>
            <h2 className="text-title-lg font-bold tracking-[-0.02em] text-on-surface">
              {t.roadmap.heroTitle}
            </h2>
          </div>
          <ArrowRight
            className="mb-1 hidden size-5 text-outline sm:block"
            aria-hidden="true"
          />
        </div>
        <div className="rounded-[1.75rem] border border-outline-variant/70 bg-surface-container-lowest p-2 shadow-sm sm:p-3">
          <RoadmapForm onGenerated={handleGenerated} />
        </div>
      </section>

      {/* Saved roadmaps */}
      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-3 border-b border-outline-variant/60 pb-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-title-lg font-bold tracking-[-0.02em] text-on-surface">
              {t.roadmap.myRoadmaps}
            </h2>
            <p className="mt-1.5 text-body-md text-on-surface-variant">
              {t.roadmap.myRoadmapsSubtitle}
            </p>
          </div>
          <div className="hidden items-center gap-2 text-label-md text-on-surface-variant sm:flex">
            <span className="size-2 rounded-full bg-primary" />
            <span>{roadmaps?.length ?? 0}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="size-10 rounded-xl" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="mt-6 h-6 w-3/4" />
                <Skeleton className="mt-3 h-4 w-1/2" />
                <Skeleton className="mt-7 h-2 w-full rounded-full" />
                <div className="mt-5 flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={<Route className="size-7" />}
            title={t.common.error}
            description={t.common.error}
            action={<Button onClick={() => void refetch()}>Retry</Button>}
          />
        ) : roadmaps && roadmaps.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-outline-variant bg-surface-container-low/50 px-6 py-12 sm:px-10">
            <EmptyState
              icon={<Route className="size-7" />}
              title={t.roadmap.noRoadmapsYet}
              description={t.roadmap.noRoadmapsSubtitle}
            />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {roadmaps?.map((r) => <RoadmapCard key={r.id} roadmap={r} />) ?? []}
          </div>
        )}
      </section>
    </div>
  );
}
