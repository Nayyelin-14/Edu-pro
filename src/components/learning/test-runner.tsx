"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

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
  eligible: boolean;
}

interface StatusResponse {
  test: { id: string; title: string; attemptLimit: number; passingScore: number };
  attemptsUsed: number;
  lastResult: TestResult | null;
}

interface CertRequestStatus {
  request: {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    decidedAt: string | null;
  } | null;
}

export function TestRunner({
  testId,
  courseId,
}: {
  testId: string;
  courseId: string;
}) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [running, setRunning] = useState<StartedTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [certStatus, setCertStatus] = useState<CertRequestStatus["request"]>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<StatusResponse>(
          `/api/learning/test/${testId}/status`,
        );
        setStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, [testId]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<CertRequestStatus>(
          `/api/certificates/request?courseId=${courseId}`,
        );
        setCertStatus(data.request);
      } catch {
        // not critical — certificate status is optional context
      }
    })();
  }, [courseId]);

  const requestCertificate = async () => {
    setRequesting(true);
    setError("");
    try {
      const data = await apiFetch<CertRequestStatus>(
        `/api/certificates/request`,
        {
          method: "POST",
          body: JSON.stringify({
            courseId,
            testResultId: result?.result.id,
          }),
        },
      );
      setCertStatus(data.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRequesting(false);
    }
  };

  useEffect(() => {
    if (!running) return;
    const endAt = new Date(running.startedAt).getTime() +
      running.test.timeLimitMinutes * 60_000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timer);
        void (async () => {
          const data = await apiFetch<SubmitResponse>(
            `/api/learning/test/${testId}/submit`,
            {
              method: "POST",
              body: JSON.stringify({ answers: [], startedAt: running.startedAt }),
            },
          );
          setResult(data);
          setRunning(null);
        })();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [running, testId]);

  const start = async () => {
    setError("");
    setStarting(true);
    try {
      const data = await apiFetch<StartedTest>(
        `/api/learning/test/${testId}/start`,
        { method: "POST" },
      );
      setRunning(data);
      setAnswers({});
      setSecondsLeft(data.test.timeLimitMinutes * 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStarting(false);
    }
  };

  const submit = async () => {
    if (!running) return;
    if (Object.keys(answers).length < running.test.questions.length) {
      setError("Answer all questions before submitting.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<SubmitResponse>(
        `/api/learning/test/${testId}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            answers: running.test.questions.map((q) => ({
              questionId: q.id,
              selected: answers[q.id],
            })),
            startedAt: running.startedAt,
          }),
        },
      );
      setResult(data);
      setRunning(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !result) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (result) {
    const mm = Math.floor(result.result.timeTakenSeconds / 60);
    const ss = result.result.timeTakenSeconds % 60;
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <Alert variant={result.result.passed ? "success" : "error"}>
            {result.result.passed
              ? "Congratulations — you passed the final test!"
              : "You did not reach the passing score."}
          </Alert>
          <p className="text-3xl font-bold">
            {result.result.score} / {result.result.total} ({result.result.percent}%)
          </p>
          <p className="text-sm text-muted-foreground">
            Time taken: {mm}m {ss}s
          </p>
          {result.certificate && (
            <div className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 p-4">
              <p className="font-medium text-emerald-700">
                A certificate has been issued to you.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Number: {result.certificate.number}
              </p>
              {result.certificate.pdfUrl && (
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <a href={result.certificate.pdfUrl} target="_blank" rel="noreferrer">
                    Download certificate
                  </a>
                </Button>
              )}
            </div>
          )}
          {result.eligible && !result.certificate && (
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
              {certStatus?.status === "PENDING" ? (
                <p className="text-sm font-medium">
                  Your certificate request is pending review by the instructor.
                </p>
              ) : certStatus?.status === "APPROVED" ? (
                <p className="text-sm font-medium">
                  Your certificate has been approved. See it in your certificates.
                </p>
              ) : certStatus?.status === "REJECTED" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Your certificate request was declined. You can request again.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void requestCertificate()}
                    disabled={requesting}
                  >
                    {requesting ? "Requesting…" : "Request certificate again"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm">
                    You passed! Request a certificate and the instructor will
                    review it.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => void requestCertificate()}
                    disabled={requesting}
                  >
                    {requesting ? "Requesting…" : "Request certificate"}
                  </Button>
                </div>
              )}
            </div>
          )}
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/learning/${courseId}`}>Back to course</Link>
            </Button>
            <Button onClick={() => setResult(null)}>Back to overview</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (running) {
    const mm = Math.floor(secondsLeft / 60);
    const ss = secondsLeft % 60;
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{running.test.title}</CardTitle>
          <Badge
            variant={secondsLeft <= 60 ? "destructive" : "secondary"}
          >
            {mm}:{ss.toString().padStart(2, "0")}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {running.test.questions.map((q, qi) => (
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
          <Button onClick={() => void submit()} disabled={loading}>
            {loading ? "Submitting…" : "Submit test"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const attemptsLeft = status
    ? Math.max(0, status.test.attemptLimit - status.attemptsUsed)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{status?.test.title ?? "Final test"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Passing score: {status?.test.passingScore}% · Attempts left: {attemptsLeft}
        </p>
        {status?.lastResult && (
          <Alert
            variant={status.lastResult.passed ? "success" : "error"}
          >
            Last attempt: {status.lastResult.score}/{status.lastResult.total} (
            {status.lastResult.percent}%)
          </Alert>
        )}
        {certStatus?.status === "PENDING" && (
          <Alert variant="info">
            Certificate request pending review by the instructor.
          </Alert>
        )}
        {certStatus?.status === "APPROVED" && (
          <Alert variant="success">
            Certificate approved — see it in your certificates.
          </Alert>
        )}
        {certStatus?.status === "REJECTED" && (
          <Alert variant="error">
            Your certificate request was declined by the instructor.
          </Alert>
        )}
        {error && <Alert variant="error">{error}</Alert>}
        {attemptsLeft > 0 ? (
          <Button onClick={() => void start()} disabled={starting}>
            {starting ? "Starting…" : "Start test"}
          </Button>
        ) : (
          <p className="text-sm text-destructive">Attempt limit reached.</p>
        )}
        <Button asChild variant="ghost" size="sm">
          <Link href={`/learning/${courseId}`}>Back to course</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
