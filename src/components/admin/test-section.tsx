"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  QuestionEditor,
  type DraftQuestion,
} from "@/components/admin/question-editor";
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
  questions?: DraftQuestion[] | unknown;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testTitle, setTestTitle] = useState("");
  const [testPass, setTestPass] = useState("60");
  const [testTime, setTestTime] = useState("30");
  const [testAttempts, setTestAttempts] = useState("3");
  const [testQuestions, setTestQuestions] = useState<DraftQuestion[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<TestData | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setTestTitle("");
    setTestPass("60");
    setTestTime("30");
    setTestAttempts("3");
    setTestQuestions([]);
  };

  const startEdit = (t: TestData) => {
    setEditingId(t.id);
    setTestTitle(t.title);
    setTestPass(String(t.passingScore));
    setTestTime(String(t.timeLimitMinutes));
    setTestAttempts(String(t.attemptLimit));
    setTestQuestions(
      Array.isArray(t.questions)
        ? (t.questions as DraftQuestion[]).map((q) => ({
            question: q.question,
            options: q.options ?? [],
            correctIndex: q.correctIndex ?? 0,
          }))
        : [],
    );
  };

  const saveTest = async () => {
    if (!testTitle.trim() || testQuestions.length === 0) {
      toast("Enter a title and at least one question", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: testTitle.trim(),
        passingScore: Number(testPass) || 60,
        timeLimitMinutes: Number(testTime) || 30,
        attemptLimit: Number(testAttempts) || 3,
        isEnabled: true,
        questions: testQuestions,
      };
      if (editingId) {
        await apiFetch(`/api/staff/tests/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast("Test updated", "success");
      } else {
        await apiFetch("/api/staff/tests", {
          method: "POST",
          body: JSON.stringify({ courseId, ...payload }),
        });
        toast("Test added", "success");
      }
      resetForm();
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteTest = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/staff/tests/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast("Test deleted", "success");
      setDeleteTarget(null);
      if (editingId === deleteTarget.id) resetForm();
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
        {tests.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No tests yet. Add at least one test so learners can finish the
            course.
          </p>
        )}
        {tests.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
          >
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                Passing {t.passingScore}% · {t.timeLimitMinutes} min ·{" "}
                {t.attemptLimit} attempts
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => startEdit(t)}
                aria-label="Edit test"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(t)}
                aria-label="Delete test"
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
        <div className="rounded-lg border p-3 space-y-3">
          <Label>{editingId ? "Edit test" : "Add test"}</Label>
          <Input
            value={testTitle}
            onChange={(e) => setTestTitle(e.target.value)}
            placeholder="Test title"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Passing %</Label>
              <Input
                type="number"
                value={testPass}
                onChange={(e) => setTestPass(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Time (min)</Label>
              <Input
                type="number"
                value={testTime}
                onChange={(e) => setTestTime(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Attempts</Label>
              <Input
                type="number"
                value={testAttempts}
                onChange={(e) => setTestAttempts(e.target.value)}
              />
            </div>
          </div>
          <QuestionEditor
            questions={testQuestions}
            onChange={setTestQuestions}
          />
          <div className="flex gap-2">
            <Button onClick={() => void saveTest()} disabled={busy}>
              <Plus />
              {editingId ? "Update test" : "Create test"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete test "${deleteTarget?.title ?? ""}"?`}
        description="This removes the final test from the course. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void deleteTest()}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}