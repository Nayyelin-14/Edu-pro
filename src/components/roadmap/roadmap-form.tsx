"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n";
import { RoadmapGenerating } from "@/components/roadmap/roadmap-generating";
import { RoadmapClarification, type ClarificationAnswerInput } from "@/components/roadmap/roadmap-clarification";
import { NimModelSelect } from "@/components/roadmap/model-select";
import {
  useGenerateRoadmap,
  useNimModels,
  toNimModelOptions,
  type ClarificationQuestion,
  type GoalInterpretationPreview,
} from "@/hooks/use-roadmaps";
import { waitForRoadmapJob } from "@/lib/roadmap-poll";

export interface GeneratedRoadmapInfo {
  id: string;
  title: string;
  goal: string;
}

export function RoadmapForm({
  onGenerated,
}: {
  onGenerated?: (roadmap: GeneratedRoadmapInfo) => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { mutate, isPending } = useGenerateRoadmap();
  const { data: modelsData } = useNimModels();
  const onGeneratedRef = useRef(onGenerated);
  useEffect(() => {
    onGeneratedRef.current = onGenerated;
  }, [onGenerated]);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [clarification, setClarification] = useState<{
    questions: ClarificationQuestion[];
    interpretation: GoalInterpretationPreview | null;
  } | null>(null);

  const [goal, setGoal] = useState("");
  const [model, setModel] = useState("");
  const selectedModel = model || modelsData?.defaultModel || "";

  const isGenerating = isPending || pollingJobId !== null;

  const runGeneration = (input: {
    goal: string;
    model?: string;
    answers?: ClarificationAnswerInput[];
  }) => {
    mutate(
      { goal: input.goal, model: input.model, answers: input.answers },
      {
        onSuccess: async (data) => {
          if (data.status === "NEEDS_CLARIFICATION") {
            setClarification({
              questions: data.questions ?? [],
              interpretation: data.interpretation ?? null,
            });
            return;
          }
          setClarification(null);
          if (data.roadmap?.id) {
            // Synchronous completion (dev inline path).
            toast(t.roadmap.generatedSuccess, "success");
            onGeneratedRef.current?.({
              id: data.roadmap.id,
              title: data.roadmap.title,
              goal: data.roadmap.goal,
            });
            return;
          }
          if (!data.jobId) return;
          // Asynchronous path: poll real progressStage, then resolve.
          setPollingJobId(data.jobId);
          try {
            const roadmap = await waitForRoadmapJob(data.jobId);
            setPollingJobId(null);
            if (!roadmap) {
              toast(t.roadmap.generationFailed, "error");
              return;
            }
            toast(t.roadmap.generatedSuccess, "success");
            onGeneratedRef.current?.({
              id: roadmap.id,
              title: roadmap.title,
              goal: roadmap.goal,
            });
          } catch (err) {
            setPollingJobId(null);
            toast(err instanceof Error ? err.message : t.common.error, "error");
          }
        },
        onError: (err) => {
          toast(err instanceof Error ? err.message : t.common.error, "error");
        },
      },
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    runGeneration({ goal: goal.trim(), model: selectedModel || undefined });
  };

  if (clarification) {
    return (
      <RoadmapClarification
        questions={clarification.questions}
        interpretation={clarification.interpretation}
        pending={isPending}
        onAnswers={(answers) => {
          setClarification(null);
          runGeneration({ goal: goal.trim(), model: selectedModel || undefined, answers });
        }}
      />
    );
  }

  if (isGenerating) {
    return <RoadmapGenerating jobId={pollingJobId} />;
  }

  return (
    <div className="w-full space-y-6">
      {/* Header with icon */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <motion.div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary to-accent shadow-md"
          whileHover={{ scale: 1.05 }}
        >
          <Sparkles className="size-5 text-white" aria-hidden="true" />
        </motion.div>
        <div>
          <h2 className="text-title-lg font-bold text-on-surface">
            {t.roadmap.createTitle}
          </h2>
          <p className="text-label-sm text-on-surface-variant">
            {t.roadmap.heroDescription}
          </p>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Goal input */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Label htmlFor="goal" className="text-label-md font-medium">
            {t.roadmap.goalLabel}
          </Label>
          <Textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={t.roadmap.goalPlaceholderShort}
            rows={3}
            required
            minLength={5}
            maxLength={500}
            disabled={isGenerating}
            className="resize-none"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-on-surface-variant">
              {t.roadmap.beSpecific}
            </p>
            <p className="text-xs text-on-surface-variant font-mono">
              {goal.length}/500
            </p>
          </div>
        </motion.div>

        {/* Model picker */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Label htmlFor="model" className="text-label-md font-medium">
            {t.roadmap.modelLabel}
          </Label>
          <NimModelSelect
            id="model"
            value={selectedModel}
            onChange={setModel}
            disabled={isGenerating}
            options={toNimModelOptions(modelsData?.models ?? [])}
            placeholder={t.common.loading}
          />
        </motion.div>

        {/* Generate button */}
        <motion.div
          className="flex justify-end pt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <motion.button
            type="submit"
            disabled={isGenerating || !goal.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-xl bg-linear-to-r from-primary to-accent px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {isGenerating ? t.roadmap.generating : t.roadmap.generateBtn}
          </motion.button>
        </motion.div>

        <p className="text-center text-xs text-on-surface-variant">
          {t.roadmap.footerNote}
        </p>
      </form>
    </div>
  );
}