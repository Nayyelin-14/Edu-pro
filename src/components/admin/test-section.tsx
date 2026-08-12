"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuestionEditor, type DraftQuestion } from "@/components/admin/question-editor";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

interface TestData {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitMinutes: number;
  attemptLimit: number;
  isEnabled: boolean;
}

export function TestSection({
  courseId,
  tests,
  onChanged,
}: {
  courseId: string;
  tests: TestData[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [testTitle, setTestTitle] = useState("");
  const [testPass, setTestPass] = useState("60");
  const [testTime, setTestTime] = useState("30");
  const [testAttempts, setTestAttempts] = useState("3");
  const [testQuestions, setTestQuestions] = useState<DraftQuestion[]>([]);

  const addTest = async () => {
    if (!testTitle.trim() || testQuestions.length === 0) {
      toast("Enter a title and at least one question", "error");
      return;
    }
    try {
      await apiFetch("/api/admin/tests", {
        method: "POST",
        body: JSON.stringify({
          courseId,
          title: testTitle,
          passingScore: Number(testPass) || 60,
          timeLimitMinutes: Number(testTime) || 30,
          attemptLimit: Number(testAttempts) || 3,
          isEnabled: true,
          questions: testQuestions,
        }),
      });
      setTestTitle("");
      setTestQuestions([]);
      toast("Test added", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const deleteTest = async (id: string) => {
    try {
      await apiFetch(`/api/admin/tests/${id}`, { method: "DELETE" });
      toast("Test deleted", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Final tests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tests.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                Passing {t.passingScore}% · {t.timeLimitMinutes} min · {t.attemptLimit} attempts
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => void deleteTest(t.id)} aria-label="Delete test">
              <Trash2 />
            </Button>
          </div>
        ))}
        <div className="rounded-lg border p-3 space-y-3">
          <Label>Add test</Label>
          <Input value={testTitle} onChange={(e) => setTestTitle(e.target.value)} placeholder="Test title" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Passing %</Label>
              <Input type="number" value={testPass} onChange={(e) => setTestPass(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Time (min)</Label>
              <Input type="number" value={testTime} onChange={(e) => setTestTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Attempts</Label>
              <Input type="number" value={testAttempts} onChange={(e) => setTestAttempts(e.target.value)} />
            </div>
          </div>
          <QuestionEditor questions={testQuestions} onChange={setTestQuestions} />
          <Button variant="outline" onClick={() => void addTest()}>
            <Plus />
            Create test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
