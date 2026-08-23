"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, HelpCircle, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import type { ClarificationQuestion, GoalInterpretationPreview } from "@/hooks/use-roadmaps";

export interface ClarificationAnswerInput {
  id: string;
  value: string;
}

interface RoadmapClarificationProps {
  questions: ClarificationQuestion[];
  interpretation: GoalInterpretationPreview | null;
  onAnswers: (answers: ClarificationAnswerInput[]) => void;
  pending: boolean;
}

/** Hybrid clarification: only genuinely ambiguous goals are asked, and only
 * 1–3 focused questions. Answers are merged server-side without a second AI
 * call. */
export function RoadmapClarification({
  questions,
  interpretation,
  onAnswers,
  pending,
}: RoadmapClarificationProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const answers = questions
      .map((q) => ({ id: q.id, value: (values[q.id] ?? "").trim() }))
      .filter((a) => a.value.length > 0);
    if (answers.length === 0) return;
    onAnswers(answers);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <motion.div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary to-accent shadow-md"
          whileHover={{ scale: 1.05 }}
        >
          <HelpCircle className="size-5 text-white" aria-hidden="true" />
        </motion.div>
        <div>
          <h2 className="text-title-lg font-bold text-on-surface">
            {t.roadmap.clarifyTitle}
          </h2>
          <p className="text-label-sm text-on-surface-variant">
            {t.roadmap.clarifySubtitle}
          </p>
        </div>
      </motion.div>

      {interpretation && (
        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5">
          <p className="flex items-center gap-1.5 text-label-sm font-medium text-on-surface-variant">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            {t.roadmap.understoodYourGoal}
          </p>
          {interpretation.role && (
            <p className="mt-1 text-title-md font-semibold text-on-surface">
              {interpretation.role}
            </p>
          )}
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
          {interpretation.assumptions.length > 0 && (
            <p className="mt-3 text-label-sm text-on-surface-variant">
              {t.roadmap.assumptions}: {interpretation.assumptions.join(" · ")}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {questions.map((q, i) => (
          <motion.div
            key={q.id}
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Label htmlFor={`q-${q.id}`} className="text-label-md font-medium">
              {i + 1}. {q.question}
            </Label>
            <Textarea
              id={`q-${q.id}`}
              value={values[q.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [q.id]: e.target.value }))}
              placeholder={q.hint}
              rows={2}
              maxLength={300}
              disabled={pending}
              className="resize-none"
            />
          </motion.div>
        ))}

        <div className="flex justify-end pt-2">
          <motion.button
            type="submit"
            disabled={pending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-xl bg-linear-to-r from-primary to-accent px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            {t.roadmap.generateBtn}
          </motion.button>
        </div>
      </form>
    </div>
  );
}