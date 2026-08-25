"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

/**
 * One-question-at-a-time presenter shared by quizzes and the final test.
 * Answers are owned by the parent (keyed by question id) so navigation never
 * loses or overwrites a selection.
 */
export function QuizStep({
  questions,
  current,
  answers,
  error,
  loading,
  submitLabel = "Submit",
  onSelect,
  onPrev,
  onNext,
  onSubmit,
}: {
  questions: QuizQuestion[];
  current: number;
  answers: Record<string, number>;
  error: string;
  loading: boolean;
  submitLabel?: string;
  onSelect: (questionId: string, optionIndex: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const q = questions[current];
  if (!q) return null;
  const isLast = current === questions.length - 1;
  const pct = Math.round(((current + 1) / questions.length) * 100);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Question {current + 1} of {questions.length}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-medium">{q.question}</p>
        <div className="grid gap-2">
          {q.options.map((option, oi) => (
            <button
              key={oi}
              type="button"
              onClick={() => onSelect(q.id, oi)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                answers[q.id] === oi && "border-primary bg-primary/10",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={onPrev} disabled={current === 0}>
          Previous
        </Button>
        {isLast ? (
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? "Submitting…" : submitLabel}
          </Button>
        ) : (
          <Button onClick={onNext}>Next</Button>
        )}
      </div>
    </div>
  );
}
