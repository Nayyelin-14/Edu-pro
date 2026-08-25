"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CheckCircle, ChevronLeft, ChevronRight, Flag, HelpCircle, Timer } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface TestQuestion {
  id: string;
  question: string;
  options: string[];
}

interface StartedTest {
  test: {
    id: string;
    title: string;
    description: string | null;
    timeLimitMinutes: number;
    passingScore: number;
    attemptLimit: number;
    questions: TestQuestion[];
  };
  startedAt: string;
}

interface TestResult {
  id: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  timeTakenSeconds: number;
}

interface SubmitResponse {
  result: TestResult;
  certificate: { id: string; number: string; pdfUrl: string | null } | null;
}

interface StatusResponse {
  test: {
    id: string;
    title: string;
    attemptLimit: number;
    passingScore: number;
    timeLimitMinutes: number;
  };
  attemptsUsed: number;
  lastResult: TestResult | null;
}

type QuestionStatus = "unanswered" | "answered" | "current" | "review" | "answered-review";

interface ExamRunnerProps {
  testId: string;
  courseId: string;
}

export function ExamRunner({ testId, courseId }: ExamRunnerProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [running, setRunning] = useState<StartedTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<StatusResponse>(`/api/learning/test/${testId}/status`);
        if (!cancelled) setStatus(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  // Submits the test and redirects to the certificate-request page, where the
  // student can formally request a certificate (which notifies the instructor).
  // Used by both the manual submit button and the auto-submit on timeout.
  const finalizeSubmission = async (
    answersSnapshot: Record<string, number>,
    startedAt: string,
  ) => {
    if (!running) return;
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<SubmitResponse>(`/api/learning/test/${testId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: running.test.questions.map((q) => ({
            questionId: q.id,
            selected: answersSnapshot[q.id] ?? -1,
          })),
          startedAt,
        }),
      });
      setRunning(null);
      router.push(
        `/learning/${courseId}/certificate/request?testResultId=${data.result.id}&passed=${data.result.passed}&percent=${data.result.percent}&score=${data.result.score}&total=${data.result.total}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!running) return;
    const endAt = new Date(running.startedAt).getTime() + running.test.timeLimitMinutes * 60_000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timer);
        void finalizeSubmission(answers, running.startedAt);
      }
    }, 1000);
    return () => clearInterval(timer);
    // finalizeSubmission intentionally reads the latest `running`/`answers`
    // captured here (both already in deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, testId, answers]);

  const start = async () => {
    setError("");
    setStarting(true);
    try {
      const data = await apiFetch<StartedTest>(`/api/learning/test/${testId}/start`, {
        method: "POST",
      });
      setRunning(data);
      setAnswers({});
      setMarkedForReview(new Set());
      setCurrentQuestionIndex(0);
      setSecondsLeft(data.test.timeLimitMinutes * 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStarting(false);
    }
  };

  const submit = async () => {
    if (!running) return;
    await finalizeSubmission(answers, running.startedAt);
  };

  const requestSubmit = () => {
    if (!running) return;
    setSubmitConfirmOpen(true);
  };

  const goToQuestion = (index: number) => {
    if (running && index >= 0 && index < running.test.questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  const goNext = () => goToQuestion(currentQuestionIndex + 1);
  const goPrevious = () => goToQuestion(currentQuestionIndex - 1);

  const toggleMarkForReview = () => {
    if (!running) return;
    const question = running.test.questions[currentQuestionIndex];
    if (!question) return;
    const qId = question.id;
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const getQuestionStatus = (index: number): QuestionStatus => {
    if (!running) return "unanswered";
    const q = running.test.questions[index];
    if (!q) return "unanswered";
    const isCurrent = index === currentQuestionIndex;
    const isAnswered = answers[q.id] !== undefined;
    const isReview = markedForReview.has(q.id);

    if (isCurrent) return "current";
    if (isAnswered && isReview) return "answered-review";
    if (isAnswered) return "answered";
    if (isReview) return "review";
    return "unanswered";
  };

  const formatTime = (seconds: number) => {
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (running) {
    const currentQuestion = running.test.questions[currentQuestionIndex];
    if (!currentQuestion) return null;
    const isFirst = currentQuestionIndex === 0;
    const isLast = currentQuestionIndex === running.test.questions.length - 1;
    const answeredCount = running.test.questions.filter((q) => answers[q.id] !== undefined).length;
    const reviewCount = markedForReview.size;
    const unansweredCount = running.test.questions.length - answeredCount;
    const submitDescription =
      unansweredCount > 0
        ? `${unansweredCount} question(s) are still unanswered. You can submit anyway, but unanswered questions count as incorrect.`
        : "Are you sure you want to submit your test? You won't be able to change your answers afterwards.";

    return (
      <>
      <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {/* Header with timer */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-background/50 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-foreground">Question {currentQuestionIndex + 1} of {running.test.questions.length}</h2>
              <Badge variant="secondary">1 Point</Badge>
            </div>
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full font-mono text-lg font-medium",
              secondsLeft <= 60 ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-primary/10 text-primary border border-primary/20"
            )}>
              <Timer className="size-5" />
              <span>{formatTime(secondsLeft)}</span>
            </div>
          </div>

          {/* Question Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="prose prose-muted max-w-none">
                <p className="text-lg leading-relaxed text-foreground">{currentQuestion.question}</p>
              </div>

              <div className="space-y-3">
                {currentQuestion.options.map((option, oi) => {
                  const isSelected = answers[currentQuestion.id] === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [currentQuestion.id]: oi }))}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left hover:bg-accent",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                        isSelected ? "border-primary bg-primary" : "border-border"
                      )}>
                        {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className={cn("text-base font-medium", isSelected ? "text-primary" : "text-foreground")}>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="p-4 border-t border-border bg-background/50 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={goPrevious}
              disabled={isFirst}
              className="gap-2"
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{answeredCount} / {running.test.questions.length} answered</span>
              {reviewCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Flag className="size-3.5" />
                  {reviewCount} marked
                </span>
              )}
            </div>
            <Button
              onClick={goNext}
              disabled={isLast}
              className="gap-2"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Side Navigator */}
        <div className="w-full md:w-72 flex-shrink-0 bg-card border border-border rounded-xl shadow-sm p-4 overflow-y-auto hidden md:block">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Question Navigator</h3>
            <Badge variant="outline" className="gap-1">
              <Timer className="size-3.5" />
              {formatTime(secondsLeft)}
            </Badge>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-4">
            {running.test.questions.map((q, qi) => {
              const status = getQuestionStatus(qi);
              const isCurrent = qi === currentQuestionIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(qi)}
                  className={cn(
                    "w-10 h-10 rounded-xl font-medium text-sm transition-all relative overflow-hidden flex items-center justify-center",
                    isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    status === "current" && "bg-primary text-primary-foreground",
                    status === "answered" && "bg-primary/10 text-primary border border-primary/20",
                    status === "review" && "bg-amber-100 text-amber-700 border border-amber-200",
                    status === "answered-review" && "bg-primary/10 text-primary border border-primary/20",
                    status === "unanswered" && "bg-muted/50 text-muted-foreground border border-border hover:bg-muted"
                  )}
                >
                  {qi + 1}
                  {markedForReview.has(q.id) && (
                    <Flag className={cn(
                      "absolute -top-1 -right-1 size-4",
                      status === "current" ? "text-primary-foreground" : "text-amber-600"
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="space-y-2 mb-4 border-t border-border pt-4">
            {[
              { label: "Current", color: "bg-primary text-primary-foreground" },
              { label: "Answered", color: "bg-primary/10 text-primary border border-primary/20" },
              { label: "Unanswered", color: "bg-muted/50 text-muted-foreground border border-border" },
              { label: "Marked for Review", color: "bg-amber-100 text-amber-700 border border-amber-200" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={cn("w-5 h-5 rounded-lg flex items-center justify-center", item.color)} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={toggleMarkForReview}
              className={cn("w-full justify-center gap-2", markedForReview.has(currentQuestion.id) && "bg-amber-100 border-amber-300 text-amber-700")}
            >
              <Flag className="size-4" />
              {markedForReview.has(currentQuestion.id) ? "Unmark Review" : "Mark for Review"}
            </Button>
            <Button
              onClick={requestSubmit}
              disabled={loading}
              className="w-full justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              size="lg"
            >
              {loading ? (
                <>
                  <Spinner className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <CheckCircle className="size-4" />
                  Submit Test
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={submitConfirmOpen}
        title="Submit test?"
        description={submitDescription}
        confirmLabel="Submit test"
        cancelLabel="Keep reviewing"
        loading={loading}
        onConfirm={() => {
          setSubmitConfirmOpen(false);
          void submit();
        }}
        onCancel={() => setSubmitConfirmOpen(false)}
      />
      </>
    );
  }

  const attemptsLeft = status
    ? Math.max(0, status.test.attemptLimit - status.attemptsUsed)
    : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="size-8 text-primary" />
          </div>
          <CardTitle>{status?.test.title ?? "Final test"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-xl">
              <Timer className="size-6 text-primary mx-auto mb-1" />
              <p className="text-sm text-muted-foreground">Time Limit</p>
              <p className="text-xl font-bold text-foreground">
                {status?.test.timeLimitMinutes} min
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-xl">
              <Flag className="size-6 text-primary mx-auto mb-1" />
              <p className="text-sm text-muted-foreground">Passing Score</p>
              <p className="text-xl font-bold text-foreground">{status?.test.passingScore}%</p>
            </div>
          </div>

          <Alert className="border-border bg-muted/50">
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Ensure you have a stable internet connection before starting.</li>
              <li>Do not refresh the page or navigate away during the exam.</li>
              <li>You can review and change your answers before final submission.</li>
              <li>The exam will auto-submit when the timer reaches zero.</li>
            </ul>
          </Alert>

          {status?.lastResult && (
            <Alert variant={status.lastResult.passed ? "success" : "error"}>
              Last attempt: {status.lastResult.score}/{status.lastResult.total} ({status.lastResult.percent}%)
            </Alert>
          )}

          {error && <Alert variant="error">{error}</Alert>}

          {attemptsLeft > 0 ? (
            <Button onClick={() => void start()} disabled={starting} className="w-full" size="lg">
              {starting ? "Starting…" : "Start Test"}
            </Button>
          ) : (
            <p className="text-center text-sm text-destructive">Attempt limit reached.</p>
          )}

          <Button asChild variant="ghost" className="w-full">
            <a href={`/learning/${courseId}`}>Back to course</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}