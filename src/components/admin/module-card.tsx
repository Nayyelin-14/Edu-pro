"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuestionEditor, type DraftQuestion } from "@/components/admin/question-editor";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

interface Lesson {
  id: string;
  title: string;
  isFree: boolean;
}

interface Quiz {
  id: string;
  title: string;
  questions: unknown;
}

interface ModuleData {
  id: string;
  title: string;
  description: string | null;
  lessons: Lesson[];
  quizzes: Quiz[];
}

function LessonRow({ lesson, onDelete }: { lesson: Lesson; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span>
        {lesson.title}
        {lesson.isFree && <Badge variant="secondary" className="ml-2">Free</Badge>}
      </span>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete lesson">
        <Trash2 />
      </Button>
    </div>
  );
}

function QuizRow({ quiz, onDelete }: { quiz: Quiz; onDelete: () => void }) {
  const questions = Array.isArray(quiz.questions)
    ? (quiz.questions as DraftQuestion[]).length
    : 0;
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
      <span>
        {quiz.title} <Badge variant="warning" className="ml-2">{questions} questions</Badge>
      </span>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete quiz">
        <Trash2 />
      </Button>
    </div>
  );
}

export function ModuleCard({
  module,
  index,
  onChanged,
}: {
  module: ModuleData;
  index: number;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonFree, setLessonFree] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<DraftQuestion[]>([]);

  const addLesson = async () => {
    if (!lessonTitle.trim()) return;
    try {
      await apiFetch("/api/admin/lessons", {
        method: "POST",
        body: JSON.stringify({ moduleId: module.id, title: lessonTitle, isFree: lessonFree }),
      });
      setLessonTitle("");
      toast("Lesson added", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const deleteLesson = async (id: string) => {
    try {
      await apiFetch(`/api/admin/lessons/${id}`, { method: "DELETE" });
      toast("Lesson deleted", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const addQuiz = async () => {
    if (!quizTitle.trim() || quizQuestions.length === 0) {
      toast("Enter a title and at least one question", "error");
      return;
    }
    try {
      await apiFetch("/api/admin/quizzes", {
        method: "POST",
        body: JSON.stringify({ moduleId: module.id, title: quizTitle, questions: quizQuestions }),
      });
      setQuizTitle("");
      setQuizQuestions([]);
      toast("Quiz added", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const deleteQuiz = async (id: string) => {
    try {
      await apiFetch(`/api/admin/quizzes/${id}`, { method: "DELETE" });
      toast("Quiz deleted", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="flex items-center gap-2 font-semibold">
            {open ? <ChevronDown /> : <ChevronRight />}
            Module {index + 1}: {module.title}
          </span>
          <Badge variant="secondary">
            {module.lessons.length} lessons · {module.quizzes.length} quizzes
          </Badge>
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              {module.lessons.map((l) => (
                <LessonRow key={l.id} lesson={l} onDelete={() => void deleteLesson(l.id)} />
              ))}
              {module.quizzes.map((q) => (
                <QuizRow key={q.id} quiz={q} onDelete={() => void deleteQuiz(q.id)} />
              ))}
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <Label>Add lesson</Label>
              <div className="flex gap-2">
                <Input
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="Lesson title"
                />
                <Button variant="outline" onClick={() => void addLesson()}>
                  <Plus />
                  Add
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={lessonFree}
                  onChange={(e) => setLessonFree(e.target.checked)}
                />
                Free preview
              </label>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <Label>Add quiz</Label>
              <Input
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="Quiz title"
              />
              <QuestionEditor
                questions={quizQuestions}
                onChange={setQuizQuestions}
              />
              <Button variant="outline" onClick={() => void addQuiz()}>
                <Plus />
                Create quiz
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
