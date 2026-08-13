"use client";

import { ArrowLeft, GraduationCap, Clock, Sparkles, Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useDeleteRoadmap, useRoadmap, useSaveRoadmap } from "@/hooks/use-roadmaps";
import { useAuth } from "@/hooks/use-auth";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressRing } from "@/components/user/progress-ring";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n";
import { useState } from "react";

export default function RoadmapDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const roadmapId = params.id as string;
  const { toast } = useToast();
  const { t } = useI18n();
  const { mutate: deleteRoadmap, isPending: deleting } = useDeleteRoadmap();
  const { mutate: saveRoadmap, isPending: saving } = useSaveRoadmap();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: roadmap, isLoading, error } = useRoadmap(roadmapId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !roadmap) {
    return (
      <div className="py-16 text-center">
        <Alert variant="error">{t.roadmap.notFound}</Alert>
        <Button asChild className="mt-4 gap-2">
          <Link href={`/${userId}/roadmap`}>
            <ArrowLeft className="size-4" />
            {t.roadmap.backToRoadmaps}
          </Link>
        </Button>
      </div>
    );
  }

  const isDraft = !roadmap.saved;

  const handleConfirmSave = () => {
    setShowSaveDialog(false);
    saveRoadmap(roadmapId, {
      onSuccess: () => toast(t.roadmap.roadmapSaved, "success"),
      onError: (err) => toast(err instanceof Error ? err.message : "Save failed", "error"),
    });
  };

  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    deleteRoadmap(roadmapId, {
      onSuccess: () => {
        toast(t.roadmap.deleted, "success");
        router.push(`/${userId}/roadmap`);
      },
      onError: (err) => toast(err instanceof Error ? err.message : "Delete failed", "error"),
    });
  };

  const handleConfirmDelete = () => {
    setShowDeleteDialog(false);
    deleteRoadmap(roadmapId, {
      onSuccess: () => {
        toast(t.roadmap.deleted, "success");
        router.push(`/${userId}/roadmap`);
      },
      onError: (err) => toast(err instanceof Error ? err.message : "Delete failed", "error"),
    });
  };

  const matched = roadmap.items.filter((i) => i.courseId !== null);
  const completed = roadmap.items.filter((i) => i.status === "COMPLETED");

  const gen = roadmap.generation;
  const formatDuration = (ms: number | null) => {
    if (ms == null) return t.roadmap.generationNotAvailable;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };
  const formatDate = (iso: string | null) => {
    if (!iso) return t.roadmap.generationNotAvailable;
    return new Date(iso).toLocaleString();
  };
  const hasGenMeta =
    gen.provider != null ||
    gen.model != null ||
    gen.inputTokens != null ||
    gen.outputTokens != null ||
    gen.totalTokens != null ||
    gen.durationMs != null ||
    gen.attemptCount != null ||
    gen.retryCount != null ||
    gen.generatedAt != null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href={`/${userId}/roadmap`}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-2 capitalize">
              {roadmap.level}
            </Badge>
            <h1 className="line-clamp-1 text-headline-md font-bold text-on-surface">
              {roadmap.title}
            </h1>
            <p className="mt-0.5 line-clamp-2 text-body-md text-on-surface-variant">
              {roadmap.goal}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <GraduationCap className="size-3.5" />
            {roadmap.completedStages} / {roadmap.matchedStages}
          </Badge>
          {isDraft ? (
            <Badge variant="secondary">{t.roadmap.notSavedYet}</Badge>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
              {t.roadmap.delete}
            </Button>
          )}
        </div>
      </div>

      {/* Review banner for unsaved drafts */}
      {isDraft && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-title-md font-semibold text-on-surface">
                  {t.roadmap.reviewRoadmap}
                </h2>
                <p className="mt-0.5 text-body-sm text-on-surface-variant">
                  {t.roadmap.reviewRoadmapDescription}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiscardDialog(true)}
                disabled={saving}
              >
                {t.roadmap.discard}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                disabled={deleting}
              >
                <Save className="mr-1.5 size-4" />
                {t.roadmap.saveRoadmapBtn}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <ProgressRing
            value={roadmap.progressPercent}
            size={84}
            strokeWidth={8}
            colorClassName="text-primary"
            label={
              <span className="text-title-lg font-bold text-on-surface">
                {roadmap.progressPercent}%
              </span>
            }
          />
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                <Clock className="size-3.5" />
                {t.roadmap.duration}
              </p>
              <p className="font-semibold text-on-surface">
                {roadmap.durationWeeks} {t.roadmap.weeks}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-label-sm text-on-surface-variant">{t.roadmap.hoursPerWeek}</p>
              <p className="font-semibold text-on-surface">
                {roadmap.hoursPerWeek} {t.roadmap.hours}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-label-sm text-on-surface-variant">{t.roadmap.totalStages}</p>
              <p className="font-semibold text-on-surface">{roadmap.totalStages}</p>
            </div>
            <div className="space-y-1">
              <p className="text-label-sm text-on-surface-variant">{t.roadmap.matchedCourses}</p>
              <p className="flex items-center gap-1 font-semibold text-on-surface">
                <Sparkles className="size-3.5 text-primary" />
                {roadmap.matchedStages}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* AI generation details (nullable columns: unknown shows "Not available", never 0) */}
      {hasGenMeta && (
        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-6">
          <h2 className="mb-4 flex items-center gap-1.5 text-title-md font-semibold text-on-surface">
            <Sparkles className="size-4 text-primary" />
            {t.roadmap.generationDetails}
          </h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-label-sm text-on-surface-variant">{t.roadmap.generationModel}</dt>
              <dd className="font-semibold text-on-surface">
                {gen.provider != null && gen.model != null
                  ? `${gen.provider} (${gen.model})`
                  : gen.provider ?? gen.model ?? t.roadmap.generationNotAvailable}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-label-sm text-on-surface-variant">{t.roadmap.generationTime}</dt>
              <dd className="font-semibold text-on-surface">{formatDuration(gen.durationMs)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-label-sm text-on-surface-variant">{t.roadmap.generationTokens}</dt>
              <dd className="font-semibold text-on-surface">
                {t.roadmap.tokenCount(gen.inputTokens, gen.outputTokens, gen.totalTokens)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-label-sm text-on-surface-variant">{t.roadmap.generationAttempts}</dt>
              <dd className="font-semibold text-on-surface">{gen.attemptCount ?? t.roadmap.generationNotAvailable}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-label-sm text-on-surface-variant">{t.roadmap.generationRetries}</dt>
              <dd className="font-semibold text-on-surface">{gen.retryCount ?? t.roadmap.generationNotAvailable}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-label-sm text-on-surface-variant">{t.roadmap.generationDate}</dt>
              <dd className="font-semibold text-on-surface">{formatDate(gen.generatedAt)}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Timeline */}
      <RoadmapTimeline
        stages={roadmap.items}
        roadmapId={roadmap.id}
        overallProgress={roadmap.progressPercent}
        matchedStages={matched.length}
        completedStages={completed.length}
      />

      <ConfirmDialog
        open={showSaveDialog}
        title={t.roadmap.saveRoadmapTitle}
        description={t.roadmap.saveRoadmapDescription}
        confirmLabel={t.roadmap.saveRoadmapBtn}
        cancelLabel={t.common.cancel}
        loading={saving}
        onConfirm={handleConfirmSave}
        onCancel={() => setShowSaveDialog(false)}
      />
      <ConfirmDialog
        open={showDiscardDialog}
        title={t.roadmap.discardRoadmapTitle}
        description={t.roadmap.discardRoadmapDescription}
        confirmLabel={t.roadmap.discard}
        cancelLabel={t.common.cancel}
        destructive
        loading={deleting}
        onConfirm={handleConfirmDiscard}
        onCancel={() => setShowDiscardDialog(false)}
      />
      <ConfirmDialog
        open={showDeleteDialog}
        title={t.roadmap.deleteRoadmapTitle}
        description={t.roadmap.deleteRoadmapDescription}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}