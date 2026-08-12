"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

interface QuizResult {
  score: number;
  total: number;
  passed: boolean;
}

export function QuizRunner({
  quizId,
  title,
  questions,
  onClose,
}: {
  quizId: string;
  title: string;
  questions: QuizQuestion[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast("Answer all questions before submitting.", "error");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<QuizResult>(
        `/api/learning/quiz?quizId=${quizId}`,
        {
          method: "POST",
          body: JSON.stringify({
            answers: questions.map((q) => ({
              questionId: q.id,
              selected: answers[q.id],
            })),
          }),
        },
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Badge variant="secondary">Quiz</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {result ? (
          <div className="space-y-4">
            <Alert variant={result.passed ? "success" : "error"}>
              {result.passed ? "You passed the quiz!" : "You did not pass this time."}
            </Alert>
            <p className="text-2xl font-bold">
              {result.score} / {result.total}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => { setResult(null); setAnswers({}); }}>
                Retry
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            {questions.map((q, qi) => (
              <div key={q.id} className="space-y-2">
                <p className="font-medium">
                  {qi + 1}. {q.question}
                </p>
                <div className="grid gap-2">
                  {q.options.map((option, oi) => (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
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
            ))}
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex gap-2">
              <Button onClick={() => void submit()} disabled={loading}>
                {loading ? "Submitting…" : "Submit answers"}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
