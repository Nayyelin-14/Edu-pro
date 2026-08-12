"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export interface DraftQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export function QuestionEditor({
  questions,
  onChange,
}: {
  questions: DraftQuestion[];
  onChange: (q: DraftQuestion[]) => void;
}) {
  const [newQuestion, setNewQuestion] = useState("");

  const addQuestion = () => {
    const q = newQuestion.trim();
    if (!q) return;
    onChange([
      ...questions,
      { question: q, options: ["", ""], correctIndex: 0 },
    ]);
    setNewQuestion("");
  };

  const update = (i: number, patch: Partial<DraftQuestion>) => {
    onChange(questions.map((q, qi) => (qi === i ? { ...q, ...patch } : q)));
  };

  const updateOption = (qi: number, oi: number, value: string) => {
    const q = questions[qi];
    if (!q) return;
    const options = q.options.map((o, idx) => (idx === oi ? value : o));
    update(qi, { options });
  };

  const remove = (i: number) => {
    onChange(questions.filter((_, qi) => qi !== i));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Question text…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addQuestion();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addQuestion}>
          Add
        </Button>
      </div>

      {questions.map((q, qi) => (
        <div key={qi} className="rounded-lg border p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-2">
              <Label>Question {qi + 1}</Label>
              <Input
                value={q.question}
                onChange={(e) => update(qi, { question: e.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(qi)}
              aria-label="Remove question"
            >
              <Trash2 />
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Options (select the correct one)</Label>
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`q${qi}-correct`}
                  checked={q.correctIndex === oi}
                  onChange={() => update(qi, { correctIndex: oi })}
                />
                <Input
                  value={opt}
                  onChange={(e) => updateOption(qi, oi, e.target.value)}
                  placeholder={`Option ${oi + 1}`}
                />
                {q.options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      update(qi, { options: q.options.filter((_, idx) => idx !== oi) })
                    }
                    aria-label="Remove option"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            {q.options.length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => update(qi, { options: [...q.options, ""] })}
              >
                Add option
              </Button>
            )}
          </div>
        </div>
      ))}

      {questions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add at least one question.
        </p>
      )}
    </div>
  );
}
