"use client";

import { useState } from "react";
import { ChevronDown, FileText, Lock, PlayCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration } from "@/lib/utils";

export interface CurriculumLesson {
  id: string;
  title: string;
  isFree: boolean;
  videoDuration: number | null;
}

export interface CurriculumQuiz {
  id: string;
  title: string;
}

export interface CurriculumModule {
  id: string;
  title: string;
  description: string | null;
  lessons: CurriculumLesson[];
  quizzes: CurriculumQuiz[];
}

export interface CurriculumTest {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitMinutes: number;
  attemptLimit: number;
}

interface CourseCurriculumProps {
  modules: CurriculumModule[];
  tests: CurriculumTest[];
}

export function CourseCurriculum({ modules, tests }: CourseCurriculumProps) {
  const [openId, setOpenId] = useState<string | null>(modules[0]?.id ?? null);

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Curriculum Structure
        </h2>
        <span className="text-sm text-muted-foreground">
          {modules.length} Modules • {totalLessons} Lessons
        </span>
      </div>

      {modules.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">No curriculum yet.</p>
      )}

      {modules.map((module, index) => {
        const open = openId === module.id;
        const moduleSeconds = module.lessons.reduce(
          (acc, l) => acc + (l.videoDuration ?? 0),
          0,
        );
        return (
          <div
            key={module.id}
            className="overflow-hidden rounded-lg border border-border bg-card"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : module.id)}
              className="flex w-full items-center justify-between gap-3 bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">
                  Module {index + 1}: {module.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
                  {moduleSeconds > 0 && ` • ${formatDuration(moduleSeconds)}`}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </button>

            {open && (
              <div className="border-t border-border bg-card">
                {module.description && (
                  <p className="px-4 pt-3 text-sm text-muted-foreground">
                    {module.description}
                  </p>
                )}
                <div className="flex flex-col gap-1 px-2 py-2">
                  {module.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {lesson.videoDuration ? (
                          <PlayCircle className="size-5 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileText className="size-5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate text-sm text-foreground">
                          {lesson.title}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {lesson.videoDuration ? (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(lesson.videoDuration)}
                          </span>
                        ) : null}
                        <Badge
                          variant={lesson.isFree ? "secondary" : "outline"}
                          className="gap-1"
                        >
                          {lesson.isFree ? (
                            "Preview"
                          ) : (
                            <>
                              <Lock className="size-3" /> Locked
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                  ))}

                  {module.quizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-primary/5 px-2 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Sparkles className="size-5 shrink-0 text-primary" />
                        <span className="truncate text-sm text-foreground">
                          {quiz.title}
                        </span>
                      </div>
                      <Badge variant="default">Quiz</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {tests.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" />
            Final test
          </h3>
          {tests.map((test) => (
            <div key={test.id} className="mt-2">
              <p className="text-sm font-medium text-foreground">{test.title}</p>
              {test.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {test.description}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Passing score {test.passingScore}% • {test.timeLimitMinutes} min •{" "}
                {test.attemptLimit} attempt{test.attemptLimit === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
