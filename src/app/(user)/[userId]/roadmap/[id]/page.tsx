"use client";

import {
  AlertCircle,
  ArrowLeft,
  Cpu,
  Gauge,
  ListChecks,
  RefreshCw,
  Save,
  Target,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  useDeleteRoadmap,
  useDiscardRoadmap,
  useRoadmap,
  useSaveRoadmap,
  useGenerateRoadmap,
  useNimModels,
  toNimModelOptions,
} from "@/hooks/use-roadmaps";
import { useAuth } from "@/hooks/use-auth";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { NimModelSelect } from "@/components/roadmap/model-select";
import { DraftBanner } from "@/components/roadmap/draft-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n";
import { waitForRoadmapJob } from "@/lib/roadmap-poll";

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
  const { mutate: discardRoadmap, isPending: discarding } = useDiscardRoadmap();
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
  const gen = roadmap.generation;

  const coverageKey = (): "success" | "info" | "warning" | "secondary" => {
    switch (roadmap.catalogCoverage) {
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
  const coverageLabel = (): string => {
    switch (roadmap.catalogCoverage) {
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
  const coverageNote = (): string => {
    switch (roadmap.catalogCoverage) {
      case "COMPLETE":
        return t.roadmap.coverageCompleteNote;
      case "PARTIAL":
        return t.roadmap.coveragePartialNote;
      case "WEAK":
        return t.roadmap.coverageWeakNote;
      default:
        return t.roadmap.coverageUnavailableNote;
    }
  };

  const qualityKey = (): "success" | "info" | "warning" | "secondary" => {
    switch (roadmap.roadmapQuality) {
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
  const qualityLabel = (): string => {
    switch (roadmap.roadmapQuality) {
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

  const handleConfirmDiscard = () => {
    discardRoadmap(roadmapId, {
      onSuccess: () => {
        toast(t.roadmap.deleted, "success");
        router.push(`/${userId}/roadmap`);
      },
      onError: (err) => toast(err instanceof Error ? err.message : t.common.error, "error"),
    });
    setShowDiscardDialog(false);
  };

  const handleConfirmDelete = () => {
    deleteRoadmap(roadmapId, {
      onSuccess: () => {
        toast(t.roadmap.deleted, "success");
        router.push(`/${userId}/roadmap`);
      },
      onError: (err) => toast(err instanceof Error ? err.message : t.common.error, "error"),
    });
    setShowDeleteDialog(false);
  };

  const handleSave = () => {
    saveRoadmap(roadmapId, {
      onSuccess: () => toast(t.roadmap.roadmapSaved, "success"),
      onError: (err) => toast(err instanceof Error ? err.message : t.common.error, "error"),
    });
  };

  return (
    <div className="space-y-6">
      {/* Draft banner — review the result before committing it */}
      {isDraft && (
        <DraftBanner
          title={t.roadmap.draftTitle}
          description={t.roadmap.draftBanner}
        >
          <Button
            variant="outline"
            onClick={() => setShowDiscardDialog(true)}
            disabled={saving || discarding}
          >
            <X className="size-4" aria-hidden="true" />
            {t.roadmap.discard}
          </Button>
          <Button onClick={handleSave} disabled={saving || discarding} className="gap-2">
            <Save className="size-4" aria-hidden="true" />
            {t.roadmap.saveRoadmapBtn}
          </Button>
        </DraftBanner>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0 mt-1">
          <Link href={`/${userId}/roadmap`}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {roadmap.level}
            </Badge>

            <Badge variant={coverageKey()}>{coverageLabel()}</Badge>

            <Badge variant={qualityKey()}>
              <Gauge className="size-3.5" />
              {qualityLabel()}
            </Badge>

            <Badge variant="outline" className="gap-1">
              <Cpu className="size-3.5" />
              {gen.model ?? t.roadmap.generationNotAvailable}
            </Badge>
          </div>

          <h1 className="text-headline-md font-bold text-on-surface line-clamp-2">
            {roadmap.title}
          </h1>

          <p className="mt-1 text-body-md text-on-surface-variant line-clamp-2">
            {roadmap.goal}
          </p>
        </div>
      </div>

      {/* Coverage notice */}
      {!isDraft && (
        <Alert
          variant={
            roadmap.catalogCoverage === "COMPLETE"
              ? "success"
              : roadmap.catalogCoverage === "PARTIAL"
                ? "info"
                : "warning"
          }
        >
          <AlertCircle className="size-4" />
          <div className="flex-1">
            <p className="text-sm font-medium">{coverageNote()}</p>
            {roadmap.missingSkills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-label-sm text-on-surface-variant">
                  {t.roadmap.missingSkills}:
                </span>
                {roadmap.missingSkills.slice(0, 6).map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-surface-container px-2.5 py-0.5 text-label-sm text-on-surface-variant"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Alert>
      )}

      {/* 2-Column Layout: Timeline (left) + Sidebar (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Timeline - Main Content (2/3 width on lg) */}
        <div className="lg:col-span-2">
          <RoadmapTimeline stages={roadmap.items} />
        </div>

        {/* Sidebar (1/3 width on lg) */}
        <div className="space-y-4">
          {/* Coverage & gaps */}
          <CoverageCard />

          {/* AI Generation Metadata Card */}
          <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-title-md font-semibold text-on-surface">
              <Cpu className="size-4 text-primary" aria-hidden="true" />
              {t.roadmap.aiGeneration}
            </h3>

            <div className="space-y-2 text-label-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  {t.roadmap.generationModel}
                </span>

                <span className="font-mono font-medium text-on-surface">
                  {gen.model ?? t.roadmap.generationNotAvailable}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  {t.roadmap.generationDate}
                </span>

                <span className="font-mono font-medium text-on-surface">
                  {gen.generatedAt ? new Date(gen.generatedAt).toLocaleString() : t.roadmap.generationNotAvailable}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  {t.roadmap.generationTime}
                </span>

                <span className="font-mono font-medium text-on-surface">
                  {gen.durationMs == null
                    ? t.roadmap.generationNotAvailable
                    : gen.durationMs < 1000
                      ? `${gen.durationMs}ms`
                      : `${(gen.durationMs / 1000).toFixed(1)}s`}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-on-surface-variant">
                  {t.roadmap.generationTokens}
                </span>

                <span className="font-mono font-medium text-on-surface">
                  {t.roadmap.tokenCount(
                    gen.inputTokens,
                    gen.outputTokens,
                    gen.totalTokens,
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Regenerate with a different model */}
          <RegenerateCard
            goal={roadmap.goal}
            currentModel={gen.model}
            userId={userId ?? ""}
          />

          {/* Delete Button */}
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t.roadmap.delete}
          </Button>
        </div>
      </div>

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={showDiscardDialog}
        title={t.roadmap.discardRoadmapTitle}
        description={t.roadmap.discardRoadmapDescription}
        confirmLabel={t.roadmap.discard}
        cancelLabel={t.common.cancel}
        destructive
        loading={discarding}
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

function CoverageCard() {
  const { t } = useI18n();
  const params = useParams();
  const roadmapId = params.id as string;
  const { data: roadmap } = useRoadmap(roadmapId);

  if (!roadmap) return null;

  const breakdown = roadmap.coverageBreakdown;
  const gaps = breakdown?.skills.filter((s) => s.status === "weak" || s.status === "unavailable") ?? [];
  const assumptions = roadmap.assumptions;

  return (
    <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-title-md font-semibold text-on-surface">
        <Target className="size-4 text-primary" aria-hidden="true" />
        {t.roadmap.coverageBreakdown}
      </h3>

      <div className="space-y-3 text-label-sm">
        <div>
          <div className="mb-1 flex justify-between text-on-surface-variant">
            <span>{t.roadmap.goalCoverage}</span>
            <span className="font-mono font-medium text-on-surface">
              {t.roadmap.coveragePercent(roadmap.goalCoverage)}
            </span>
          </div>
          <Progress
            value={roadmap.goalCoverage}
            indicatorClassName="bg-primary"
            aria-label={t.roadmap.goalCoverage}
          />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-on-surface-variant">
            <span>{t.roadmap.courseAvailability}</span>
            <span className="font-mono font-medium text-on-surface">
              {t.roadmap.coveragePercent(roadmap.courseAvailability)}
            </span>
          </div>
          <Progress
            value={roadmap.courseAvailability}
            indicatorClassName="bg-secondary"
            aria-label={t.roadmap.courseAvailability}
          />
        </div>

        {typeof roadmap.confidence === "number" && (
          <div className="flex justify-between">
            <span className="text-on-surface-variant">
              {t.roadmap.confidenceLabel}
            </span>
            <span className="font-mono font-medium text-on-surface">
              {t.roadmap.coveragePercent(Math.round(roadmap.confidence * 100))}
            </span>
          </div>
        )}
      </div>

      {/* Gaps with honest reasons */}
      {gaps.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-label-sm font-medium text-on-surface">
            <ListChecks className="size-3.5 text-on-surface-variant" aria-hidden="true" />
            {t.roadmap.missingSkills}
          </p>
          <ul className="space-y-2">
            {gaps.map((g) => (
              <li key={g.skill} className="rounded-lg bg-surface-container px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-on-surface">{g.skill}</span>
                  <Badge variant={g.status === "unavailable" ? "secondary" : "warning"}>
                    {g.status === "unavailable"
                      ? t.roadmap.gapStatus.unavailable
                      : t.roadmap.gapStatus.weak}
                  </Badge>
                </div>
                <p className="mt-0.5 text-label-sm text-on-surface-variant">
                  {t.roadmap.importance[g.importance]} · {t.roadmap.coverageReason[g.reason as keyof typeof t.roadmap.coverageReason] ?? g.reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Assumptions behind the interpretation */}
      {assumptions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-label-sm font-medium text-on-surface">
            {t.roadmap.assumptions}
          </p>
          <ul className="space-y-1">
            {assumptions.map((a, i) => (
              <li key={i} className="flex gap-1.5 text-label-sm text-on-surface-variant">
                <span className="text-primary">•</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RegenerateCard({
  goal,
  currentModel,
  userId,
}: {
  goal: string;
  currentModel: string | null;
  userId: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const { mutate: generate, isPending } = useGenerateRoadmap();
  const { data: modelsData } = useNimModels();
  const [model, setModel] = useState("");
  const [polling, setPolling] = useState(false);

  const busy = isPending || polling;
  const options = toNimModelOptions(modelsData?.models ?? []);
  // Prefer the user's explicit choice, then the model that built this roadmap,
  // then the top-ranked default — so Regenerate stays connected to this path.
  const selectedModel = model || currentModel || modelsData?.defaultModel || "";
  const goToRoadmap = (id: string) => router.replace(`/${userId}/roadmap/${id}`);

  const handleRegenerate = () => {
    setPolling(true);
    generate(
      { goal, model: selectedModel || undefined, refresh: true },
      {
        onSuccess: async (data) => {
          if (data.roadmap?.id) {
            setPolling(false);
            toast(t.roadmap.generatedSuccess, "success");
            goToRoadmap(data.roadmap.id);
            return;
          }
          if (!data.jobId) {
            setPolling(false);
            return;
          }
          try {
            const roadmap = await waitForRoadmapJob(data.jobId);
            setPolling(false);
            if (!roadmap) {
              toast(t.roadmap.generationFailed, "error");
              return;
            }
            toast(t.roadmap.generatedSuccess, "success");
            goToRoadmap(roadmap.id);
          } catch (err) {
            setPolling(false);
            toast(err instanceof Error ? err.message : t.common.error, "error");
          }
        },
        onError: (err) => {
          setPolling(false);
          toast(err instanceof Error ? err.message : t.common.error, "error");
        },
      },
    );
  };

  return (
    <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm">
      <h3 className="mb-1 flex items-center gap-2 text-title-md font-semibold text-on-surface">
        <RefreshCw className="size-4 text-primary" aria-hidden="true" />
        {t.roadmap.regenerateTitle}
      </h3>
      <p className="mb-3 text-label-sm text-on-surface-variant">
        {t.roadmap.regenerateDescription}
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-label-sm text-on-surface-variant">
            {t.roadmap.modelLabel}
          </label>
          <NimModelSelect
            value={selectedModel}
            onChange={setModel}
            options={options}
            disabled={busy}
          />
        </div>
        <Button className="w-full gap-2" onClick={handleRegenerate} disabled={busy}>
          <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          {busy ? t.roadmap.regenerating : t.roadmap.regenerateBtn}
        </Button>
      </div>
    </div>
  );
}