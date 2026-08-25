"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useLearningFlow } from "@/components/learning/learning-flow";
import { QuizStep } from "@/components/learning/quiz-step";

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
  onClose?: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flow = useLearningFlow();
  // Default close behaviour: drop the ?quiz= param so the lesson view returns.
  const handleClose =
    onClose ??
    (() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("quiz");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
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
      if (data.passed) {
        router.refresh();
        flow.notifyCompleted({ id: quizId, type: "quiz" });
      }
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
              <Button onClick={() => { setResult(null); setAnswers({}); setCurrent(0); }}>
                Retry
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <QuizStep
            questions={questions}
            current={current}
            answers={answers}
            error={error}
            loading={loading}
            submitLabel="Submit Quiz"
            onSelect={(qid, oi) => setAnswers((a) => ({ ...a, [qid]: oi }))}
            onPrev={() => setCurrent((c) => Math.max(0, c - 1))}
            onNext={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            onSubmit={() => void submit()}
          />
        )}
      </CardContent>
    </Card>
  );
}
