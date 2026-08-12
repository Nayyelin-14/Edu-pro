"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Flag, Timer, CheckCircle, XCircle, HelpCircle } from "lucide-react";

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
  test: { id: string; title: string; attemptLimit: number; passingScore: number };
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
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
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


  useEffect(() => {
    if (!running) return;
    const endAt = new Date(running.startedAt).getTime() + running.test.timeLimitMinutes * 60_000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timer);
        void (async () => {
          try {
            const data = await apiFetch<SubmitResponse>(`/api/learning/test/${testId}/submit`, {
              method: "POST",
              body: JSON.stringify({
                answers: running.test.questions.map((q) => ({
                  questionId: q.id,
                  selected: answers[q.id] ?? -1,
                })),
                startedAt: running.startedAt,
              }),
            });
            setResult(data);
            setRunning(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Auto-submit failed");
          }
        })();
      }
    }, 1000);
    return () => clearInterval(timer);
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
    const unansweredCount = running.test.questions.filter((q) => answers[q.id] === undefined).length;
    if (unansweredCount > 0) {
      if (!confirm(`${unansweredCount} question(s) unanswered. Submit anyway?`)) return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<SubmitResponse>(`/api/learning/test/${testId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: running.test.questions.map((q) => ({
            questionId: q.id,
            selected: answers[q.id] ?? -1,
          })),
          startedAt: running.startedAt,
        }),
      });
      setResult(data);
      setRunning(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
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

  if (loading && !result) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (result) {
    const mm = Math.floor(result.result.timeTakenSeconds / 60);
    const ss = result.result.timeTakenSeconds % 60;
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="space-y-6 p-8 text-center">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
              result.result.passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
            )}>
              {result.result.passed ? (
                <CheckCircle className="size-8" />
              ) : (
                <XCircle className="size-8" />
              )}
            </div>
            <Alert variant={result.result.passed ? "success" : "error"} className="text-center">
              {result.result.passed
                ? "Congratulations — you passed the final test!"
                : "You did not reach the passing score."}
            </Alert>
            <p className="text-4xl font-bold text-foreground">
              {result.result.score} / {result.result.total} <span className="text-muted-foreground font-normal">({result.result.percent}%)</span>
            </p>
            <p className="text-muted-foreground">Time taken: {mm}m {ss}s</p>
            {result.certificate && (
              <div className="rounded-xl border border-emerald-600/40 bg-emerald-600/10 p-6">
                <p className="font-medium text-emerald-700 flex items-center justify-center gap-2">
                  <HelpCircle className="size-5" />
                  A certificate has been issued to you.
                </p>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                  Number: <span className="font-mono font-medium">{result.certificate.number}</span>
                </p>
                {result.certificate.pdfUrl && (
                  <Button asChild variant="outline" className="mt-4">
                    <a href={result.certificate.pdfUrl} target="_blank" rel="noreferrer">
                      Download certificate
                    </a>
                  </Button>
                )}
              </div>
            )}
            <div className="flex gap-3 justify-center pt-4">
              <Button asChild variant="outline" size="lg">
                <a href={`/learning/${courseId}`}>Back to course</a>
              </Button>
              <Button size="lg" onClick={() => setResult(null)}>Back to overview</Button>
            </div>
          </CardContent>
        </Card>
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

    return (
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
              onClick={submit}
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
              <p className="text-xl font-bold text-foreground">{status?.test.passingScore}%</p>
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