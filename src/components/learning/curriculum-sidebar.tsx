"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  CheckCircle2,
  ChevronLeft,
  FileQuestion,
  ListVideo,
  X,
} from "lucide-react";
import { cn, formatClockTime } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface ModuleShape {
  id: string;
  title: string;
  description?: string | null;
  position: number;
  lessons: {
    id: string;
    title: string;
    position: number;
    isFree: boolean;
    videoDuration: number | null;
  }[];
  quizzes: { id: string; title: string }[];
}

interface TestShape {
  id: string;
  title: string;
  timeLimitMinutes: number | null;
}

interface CurriculumSidebarProps {
  modules: ModuleShape[];
  tests: TestShape[];
  completedLessonIds: string[];
  courseId: string;
  currentLessonId?: string;
  currentQuizId?: string;
}

type SidebarRow =
  | { type: "module"; module: ModuleShape }
  | {
      type: "lesson";
      lesson: ModuleShape["lessons"][number];
      number: number;
    }
  | { type: "quiz"; quiz: ModuleShape["quizzes"][number] };

export function CurriculumSidebar({
  modules,
  tests,
  completedLessonIds,
  courseId,
  currentLessonId,
  currentQuizId,
}: CurriculumSidebarProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedCount = completedLessonIds.length;
  const progressPercent =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const rows: SidebarRow[] = [];
  let lessonCount = 0;

  for (const mod of modules) {
    rows.push({ type: "module", module: mod });

    for (const lesson of mod.lessons) {
      lessonCount += 1;
      rows.push({ type: "lesson", lesson, number: lessonCount });
    }

    for (const quiz of mod.quizzes) {
      rows.push({ type: "quiz", quiz });
    }
  }

  const body = (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-none">
        <h3 className="font-semibold text-foreground text-sm">
          Course Content
        </h3>

        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          {completedCount} / {totalLessons} complete
        </p>

        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          />
        </div>
      </div>

      {/* Scrollable lesson/module/quiz list */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="divide-y divide-border/40">
          {rows.map((row) => {
            if (row.type === "module") {
              return (
                <div
                  key={row.module.id}
                  className="px-4 py-2 bg-muted/30 sticky top-0 z-10"
                >
                  <p className="text-xs font-semibold text-foreground">
                    Module {row.module.position}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {row.module.title}
                    </span>
                  </p>
                </div>
              );
            }

            if (row.type === "quiz") {
              const active = currentQuizId === row.quiz.id;

              return (
                <Link
                  key={`q${row.quiz.id}`}
                  href={`/learning/${courseId}?quiz=${row.quiz.id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-[3px]",
                    active
                      ? "bg-primary/10 border-l-primary"
                      : "border-l-transparent hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <FileQuestion className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-xs font-medium truncate",
                        active ? "text-primary" : "text-foreground",
                      )}
                    >
                      {row.quiz.title}
                    </p>

                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      Quiz
                    </p>
                  </div>
                </Link>
              );
            }

            const lesson = row.lesson;
            const done = completedLessonIds.includes(lesson.id);
            const active = currentLessonId === lesson.id;

            return (
              <Link
                key={`l${lesson.id}`}
                href={`/learning/${courseId}?lesson=${lesson.id}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-[3px]",
                  active
                    ? "bg-primary/10 border-l-primary"
                    : "border-l-transparent hover:bg-muted/50",
                )}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold",
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    !done && !active && "font-mono",
                  )}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : row.number}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-xs font-medium truncate",
                      active ? "text-primary" : "text-foreground",
                    )}
                  >
                    {lesson.title}
                  </p>

                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {lesson.videoDuration
                      ? formatClockTime(lesson.videoDuration)
                      : "Reading"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Final Tests - above Back to My Courses */}
      {tests.length > 0 && (
        <div className="flex-none border-t border-border">
          <div className="px-4 py-2 bg-muted/30">
            <p className="text-xs font-semibold text-foreground">Final Tests</p>
          </div>

          <div className="divide-y divide-border/40">
            {tests.map((test) => (
              <Link
                key={test.id}
                href={`/learning/${courseId}/test/${test.id}`}
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-[3px] border-l-transparent hover:bg-muted/50"
              >
                <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-500/15 text-amber-500">
                  <FileQuestion className="h-3.5 w-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-foreground">
                    {test.title}
                  </p>

                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {test.timeLimitMinutes
                      ? `${test.timeLimitMinutes} min`
                      : "Test"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Back to My Courses - fixed at bottom */}
      <div className="p-4 border-t border-border flex-none">
        <Link
          href={`/${user?.id}/my-courses`}
          className="flex items-center justify-center gap-2 w-full border border-border rounded-lg px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to My Courses
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop column */}
      <aside className="hidden xl:block w-full min-w-0 border-l border-border bg-card/40 h-full min-h-0 overflow-hidden">
        {body}
      </aside>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="xl:hidden fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg shadow-primary/30 hover:opacity-90 transition-opacity"
      >
        <ListVideo className="size-4" />
        Course Content
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="absolute inset-y-0 right-0 w-[85vw] max-w-sm bg-card border-l border-border flex flex-col shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close course content"
            >
              <X className="size-4" />
            </button>

            <div className="flex-1 min-h-0 overflow-hidden">{body}</div>
          </div>
        </div>
      )}
    </>
  );
}
