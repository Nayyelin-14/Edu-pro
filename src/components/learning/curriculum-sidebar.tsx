"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  FileQuestion,
  Lock,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";

interface CurriculumSidebarProps {
  modules: {
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
  }[];
  tests: { id: string; title: string }[];
  completedLessonIds: string[];
  courseId: string;
  currentLessonId?: string;
  currentQuizId?: string;
}

export function CurriculumSidebar({
  modules,
  tests,
  completedLessonIds,
  courseId,
  currentLessonId,
  currentQuizId,
}: CurriculumSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(
    modules.reduce((acc, m) => ({ ...acc, [m.id]: true }), {})
  );

  const completedSet = new Set(completedLessonIds);

  const filteredModules = modules.filter((module) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (module.title.toLowerCase().includes(query)) return true;
    return module.lessons.some((l) => l.title.toLowerCase().includes(query));
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const toggleModule = (moduleId: string) => {
    setOpenModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const allLessons = modules.flatMap((m) => m.lessons);

  return (
    <aside className="w-80 flex-none border-r border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex-none">
        <h2 className="text-lg font-semibold text-foreground mb-3">Curriculum</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search lessons..."
            className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-full text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {filteredModules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No lessons found matching &ldquo;{searchQuery}&rdquo;
          </p>
        ) : (
          filteredModules.map((module, moduleIdx) => {
            const isOpen = openModules[module.id];
            return (
              <div key={module.id} className="space-y-2">
                {/* Module Header */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleModule(module.id)}
                    className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors w-full text-left"
                  >
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-90"
                      )}
                    />
                    <span>Module {moduleIdx + 1}: {module.title}</span>
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-1 ml-6">
                    {/* Lessons */}
                    {module.lessons.map((lesson) => {
                      const done = completedLessonIds.includes(lesson.id);
                      const active = currentLessonId === lesson.id;
                      const locked = !done && !lesson.isFree;
                      return (
                        <Link
                          key={lesson.id}
                          href={`/learning/${courseId}?lesson=${lesson.id}`}
                          className={cn(
                            "flex items-start gap-3 px-2 py-2 rounded-lg text-sm transition-colors hover:bg-accent group",
                            active && "bg-accent font-medium text-primary",
                            locked && "opacity-60 cursor-not-allowed"
                          )}
                          onClick={(e) => {
                            if (locked) e.preventDefault();
                          }}
                        >
                          {/* Status indicator */}
                          <div className="flex-shrink-0 mt-1">
                            {done ? (
                              <CheckCircle2
                                className="size-4 text-emerald-500"
                                aria-label="Completed"
                              />
                            ) : locked ? (
                              <Lock className="size-4 text-muted-foreground" aria-label="Locked" />
                            ) : (
                              <Circle className="size-4 text-muted-foreground" aria-label="Not started" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{lesson.title}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              {lesson.videoDuration && (
                                <>
                                  <span className="flex items-center">
                                    <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polygon points="23 7 16 12 23 17 23 7" />
                                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                    </svg>
                                  </span>
                                  {formatDuration(lesson.videoDuration)}
                                </>
                              )}
                              {!lesson.videoDuration && "Reading"}
                            </p>
                          </div>
                        </Link>
                      );
                    })}

                    {/* Quizzes */}
                    {module.quizzes.map((quiz) => (
                      <Link
                        key={quiz.id}
                        href={`/learning/${courseId}?quiz=${quiz.id}`}
                        className={cn(
                          "flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-amber-600 hover:bg-accent transition-colors group",
                          currentQuizId === quiz.id && "bg-accent font-medium"
                        )}
                      >
                        <FileQuestion className="size-4 shrink-0" />
                        <span className="truncate font-medium">{quiz.title}</span>
                        <span className="text-xs text-muted-foreground ml-auto">Quiz</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Final Tests */}
        {tests.length > 0 && (
          <div className="border-t border-border pt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Final Tests
            </h3>
            {tests.map((test) => (
              <Link
                key={test.id}
                href={`/learning/${courseId}/test/${test.id}`}
                className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-indigo-600 hover:bg-accent transition-colors"
              >
                <FileQuestion className="size-4 shrink-0" />
                <span className="truncate font-medium">{test.title}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Back Link */}
        <div className="border-t border-border pt-4 mt-4">
          <Link
            href={`/my-courses`}
            className="flex items-center justify-center gap-2 w-full border border-border rounded-lg px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft className="size-4" />
            Back to My Courses
          </Link>
        </div>
      </div>
    </aside>
  );
}