"use client";

import { Check, Loader2, Circle, AlertCircle, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { useRoadmapJob } from "@/hooks/use-roadmaps";

/** Real backend progress stages -> UI step ordering. No fake timers or
 * random percentages: only genuine worker transitions are rendered. */
const STAGE_ORDER: Array<{ backend: string; key: string }> = [
  { backend: "interpreting", key: "understand" },
  { backend: "retrieving", key: "retrieve" },
  { backend: "generating", key: "rank" },
  { backend: "validating", key: "match" },
  { backend: "finalizing", key: "finalize" },
];

function indexOfStage(progressStage?: string | null): number {
  if (!progressStage) return -1;
  const idx = STAGE_ORDER.findIndex((s) => s.backend === progressStage);
  if (idx >= 0) return idx;
  if (progressStage === "completed") return STAGE_ORDER.length;
  if (progressStage === "failed") return -2;
  return -1;
}

export function RoadmapGenerating({ jobId }: { jobId?: string | null }) {
  const { t } = useI18n();
  const { data: job } = useRoadmapJob(jobId ?? null);
  const progressStage = job?.progressStage ?? null;
  const current = indexOfStage(progressStage);
  const failed = current === -2;
  const interpretation = job?.interpretation ?? null;

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-12 text-center">
      <motion.div
        animate={{ rotate: [0, 15, -15, 0], y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="text-5xl"
      >
        ✨
      </motion.div>

      <div>
        <h2 className="mb-2 text-2xl font-bold text-on-surface">
          {failed ? t.roadmap.generationFailed : t.roadmap.generating}
        </h2>
        <p className="text-sm text-on-surface-variant">
          {failed ? t.roadmap.generationFailedNote : t.roadmap.generatingNote}
        </p>
      </div>

      {interpretation?.role && !failed && (
        <div className="w-full max-w-md rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-4 text-left">
          <p className="flex items-center gap-1.5 text-label-sm font-medium text-on-surface-variant">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            {t.roadmap.understoodYourGoal}
          </p>
          <p className="mt-1 text-title-md font-semibold text-on-surface">
            {interpretation.role}
          </p>
          {interpretation.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {interpretation.skills.slice(0, 8).map((s, i) => (
                <span
                  key={i}
                  className="rounded-full bg-primary/10 px-2.5 py-0.5 text-label-sm font-medium text-primary"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Honest stage checklist driven by the worker's real progressStage. */}
      <div className="w-full max-w-md space-y-2.5" role="status" aria-live="polite">
        {STAGE_ORDER.map((step, i) => {
          const isCompleted = current > i || current >= STAGE_ORDER.length;
          const isActive = !failed && current === i;
          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "flex items-center gap-4 rounded-xl border p-3.5 transition-all duration-300",
                isActive
                  ? "bg-primary/8 border-primary/40 shadow-md shadow-primary/10"
                  : isCompleted
                    ? "bg-success/8 border-success/30"
                    : "bg-muted/40 border-border",
              )}
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                {isCompleted ? (
                  <Check className="size-4 text-success" />
                ) : isActive ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Loader2 className="size-4 text-primary" />
                  </motion.div>
                ) : (
                  <Circle className="size-3 text-muted-foreground" />
                )}
              </div>
              <span
                className={cn(
                  "text-label-md font-medium transition-colors",
                  isCompleted
                    ? "text-success"
                    : isActive
                      ? "text-primary"
                      : "text-on-surface-variant",
                )}
              >
                {t.roadmap.generatingSteps[step.key as keyof typeof t.roadmap.generatingSteps]}
              </span>
            </motion.div>
          );
        })}

        {failed && (
          <div className="flex items-center gap-3 rounded-xl border border-error/40 bg-error/8 p-3.5">
            <AlertCircle className="size-4 text-error" />
            <span className="text-label-md font-medium text-error">
              {t.roadmap.generationFailedNote}
            </span>
          </div>
        )}
      </div>

      {/* Honest indeterminate state — no fake percentages. */}
      {!failed && current < STAGE_ORDER.length && (
        <p className="text-xs text-on-surface-variant">
          {t.roadmap.honestProgress}
        </p>
      )}
    </div>
  );
}