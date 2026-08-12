"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";

interface QuizResult {
  id: string;
  score: number;
  total: number;
  passed: boolean;
  createdAt: string;
  quiz: {
    id: string;
    title: string;
    module: { course: { id: string; title: string } };
  };
}

interface TestResult {
  id: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  submittedAt: string;
  test: { id: string; title: string; course: { id: string; title: string } };
}

interface ScoresResponse {
  quizResults: QuizResult[];
  testResults: TestResult[];
}

export function ScoresPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-scores"],
    queryFn: () => apiFetch<ScoresResponse>("/api/me/scores"),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const quizzes = data?.quizResults ?? [];
  const tests = data?.testResults ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>My results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {quizzes.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Quiz results
            </h3>
            <div className="space-y-2">
              {quizzes.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{r.quiz.title}</p>
                    <p className="text-xs text-muted-foreground">{r.quiz.module.course.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>
                      {r.score}/{r.total}
                    </span>
                    <Badge variant={r.passed ? "success" : "destructive"}>
                      {r.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tests.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Test results
            </h3>
            <div className="space-y-2">
              {tests.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{r.test.title}</p>
                    <p className="text-xs text-muted-foreground">{r.test.course.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>
                      {r.score}/{r.total} ({r.percent}%)
                    </span>
                    <Badge variant={r.passed ? "success" : "destructive"}>
                      {r.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {quizzes.length === 0 && tests.length === 0 && (
          <p className="text-sm text-muted-foreground">No results yet. Start learning!</p>
        )}
      </CardContent>
    </Card>
  );
}
