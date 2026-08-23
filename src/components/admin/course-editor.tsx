"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Eye,
  GripVertical,
  PlayCircle,
  Plus,
  Save,
  Send,
  Trash2,
  FileText,
  HelpCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { cn, formatDuration } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { CourseDetailsForm } from "@/components/admin/course-details-form";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { TestSection } from "@/components/admin/test-section";
import { MediaUploader } from "@/components/admin/media-uploader";
import {
  QuestionEditor,
  type DraftQuestion,
} from "@/components/admin/question-editor";

type ApprovalStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

function approvalBadge(status: ApprovalStatus) {
  switch (status) {
    case "APPROVED":
      return { variant: "success" as const, label: "Approved" };
    case "PENDING_REVIEW":
      return { variant: "warning" as const, label: "Pending review" };
    case "REJECTED":
      return { variant: "destructive" as const, label: "Rejected" };
    default:
      return { variant: "secondary" as const, label: "Draft" };
  }
}

interface Lesson {
  id: string;
  title: string;
  type: "VIDEO" | "READING";
  videoUrl: string | null;
  pdfUrl: string | null;
  videoDuration: number | null;
  article: string | null;
  position: number;
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
  position: number;
  lessons: Lesson[];
  quizzes: Quiz[];
}

interface AdminCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverImage: string | null;
  price: number;
  isPublished: boolean;
  isFeatured: boolean;
  approvalStatus: ApprovalStatus;
  category: { id: string; name: string } | null;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  estimatedHours: number | null;
  skills: string[] | null;
  prerequisites: string[] | null;
  modules: ModuleData[];
  tests: {
    id: string;
    title: string;
    description: string | null;
    passingScore: number;
    timeLimitMinutes: number;
    attemptLimit: number;
    isEnabled: boolean;
    questions: DraftQuestion[] | null;
  }[];
}

type EditorTab = "lesson" | "quiz" | "details" | "test";

export function CourseEditor({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPERADMIN";

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<EditorTab>("lesson");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [dragLesson, setDragLesson] = useState<string | null>(null);
  const [dragModule, setDragModule] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptKind, setPromptKind] = useState<"module" | "lesson">("module");
  const [promptModuleId, setPromptModuleId] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  const courseQuery = useQuery({
    queryKey: ["admin-course", courseId],
    queryFn: () => apiFetch<AdminCourse>(`/api/staff/courses/${courseId}`),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<{ id: string; name: string }[]>("/api/categories"),
  });

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["admin-course", courseId] });

  const selectedLesson = (() => {
    const mods = courseQuery.data?.modules ?? [];
    for (const m of mods) {
      const found = m.lessons.find((l) => l.id === selectedLessonId);
      if (found) return { lesson: found, module: m };
    }
    return null;
  })();

  const selectedQuiz = (() => {
    const mods = courseQuery.data?.modules ?? [];
    for (const m of mods) {
      const found = m.quizzes.find((q) => q.id === selectedQuizId);
      if (found) return { quiz: found, module: m };
    }
    return null;
  })();

  const toggleModule = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const changeStatus = async (
    action: "submit" | "approve" | "reject" | "draft",
    successMsg: string,
  ) => {
    if (!courseQuery.data) return;
    if (action === "submit" && courseQuery.data.tests.length === 0) {
      toast("Each course must have at least one test before submission", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/staff/courses/${courseId}/${action}`, {
        method: "POST",
      });
      toast(successMsg, "success");
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  };

  const openAddModule = () => {
    setPromptKind("module");
    setPromptModuleId(null);
    setPromptOpen(true);
  };

  const openAddLesson = (moduleId: string) => {
    setPromptKind("lesson");
    setPromptModuleId(moduleId);
    setPromptOpen(true);
  };

  const confirmPrompt = async (value: string) => {
    setPromptLoading(true);
    try {
      if (promptKind === "module") {
        await apiFetch("/api/staff/modules", {
          method: "POST",
          body: JSON.stringify({ courseId, title: value }),
        });
        toast("Module added", "success");
      } else {
        if (!promptModuleId) return;
        // New lessons are born as READING with starter content — the server
        // rejects incomplete lessons. Switch to VIDEO in the lesson editor.
        await apiFetch("/api/staff/lessons", {
          method: "POST",
          body: JSON.stringify({
            moduleId: promptModuleId,
            title: value,
            type: "READING",
            article: "<p><em>Start writing your lesson…</em></p>",
          }),
        });
        toast("Lesson added", "success");
      }
      invalidate();
      setPromptOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setPromptLoading(false);
    }
  };

  const addQuiz = async (moduleId: string) => {
    const mod = courseQuery.data?.modules.find((m) => m.id === moduleId);
    if (mod && mod.quizzes.length > 0) {
      toast("This module already has a quiz", "error");
      return;
    }
    try {
      await apiFetch("/api/staff/quizzes", {
        method: "POST",
        body: JSON.stringify({ moduleId, title: "New quiz" }),
      });
      toast("Quiz added", "success");
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const selectLesson = (id: string) => {
    setSelectedLessonId(id);
    setSelectedQuizId(null);
    setSelectedTab("lesson");
  };

  const selectQuiz = (id: string) => {
    setSelectedQuizId(id);
    setSelectedLessonId(null);
    setSelectedTab("quiz");
  };

  /**
   * Applies a new order to a list of { id, position } records by PATCHing each
   * item's position. Uses temporary negative positions to avoid hitting the
   * (courseId|moduleId, position) unique constraint mid-reorder.
   */
  const applyOrder = async (
    items: { id: string; position: number }[],
    endpoint: (id: string) => string,
  ) => {
    for (const item of items) {
      await apiFetch(endpoint(item.id), {
        method: "PATCH",
        body: JSON.stringify({ position: -(item.position + 1) }),
      });
    }
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) continue;
      await apiFetch(endpoint(item.id), {
        method: "PATCH",
        body: JSON.stringify({ position: i }),
      });
    }
  };

  const reorderLessons = async (
    moduleId: string,
    orderedLessonIds: string[],
  ) => {
    const target = courseQuery.data?.modules.find((m) => m.id === moduleId);
    if (!target) return;
    const byId = new Map(target.lessons.map((l) => [l.id, l]));
    const items = orderedLessonIds
      .map((id, index) => ({ id, position: byId.get(id)?.position ?? index }))
      .filter((x) => byId.has(x.id));
    try {
      await applyOrder(items, (id) => `/api/staff/lessons/${id}`);
      toast("Lessons reordered", "success");
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reorder failed", "error");
    }
  };

  const reorderModules = async (orderedModuleIds: string[]) => {
    const modules = courseQuery.data?.modules ?? [];
    const byId = new Map(modules.map((m) => [m.id, m]));
    const items = orderedModuleIds
      .map((id, index) => ({ id, position: byId.get(id)?.position ?? index }))
      .filter((x) => byId.has(x.id));
    try {
      await applyOrder(items, (id) => `/api/staff/modules/${id}`);
      toast("Modules reordered", "success");
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reorder failed", "error");
    }
  };

  if (courseQuery.isLoading || !courseQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  const course = courseQuery.data;
  const activeLesson = selectedTab === "lesson" ? selectedLesson : null;
  const activeQuiz = selectedTab === "quiz" ? selectedQuiz : null;

  return (
    <div className="flex h-full flex-col">
      {/* Editor header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Course Editor
          </p>
          <h1 className="truncate text-2xl font-bold">{course.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            {(() => {
              const badge = approvalBadge(course.approvalStatus);
              return <Badge variant={badge.variant}>{badge.label}</Badge>;
            })()}
            <span className="text-xs text-muted-foreground">
              {course.modules.length} modules ·{" "}
              {course.modules.reduce((a, m) => a + m.lessons.length, 0)} lessons
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/courses/${course.slug}`} target="_blank">
              <Eye />
              Preview
            </Link>
          </Button>
          {course.approvalStatus === "APPROVED" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void changeStatus("draft", "Course sent back to draft")}
              disabled={saving}
            >
              Unpublish
            </Button>
          ) : null}
          {isSuperAdmin && course.approvalStatus !== "APPROVED" ? (
            <Button
              size="sm"
              onClick={() => void changeStatus("approve", "Course approved and published")}
              disabled={saving}
            >
              <CheckCircle2 />
              Approve
            </Button>
          ) : null}
          {isSuperAdmin && course.approvalStatus !== "DRAFT" ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void changeStatus("reject", "Course rejected")}
              disabled={saving}
            >
              <XCircle />
              Reject
            </Button>
          ) : null}
          {!isSuperAdmin &&
          (course.approvalStatus === "DRAFT" ||
            course.approvalStatus === "REJECTED") ? (
            <Button
              size="sm"
              onClick={() =>
                void changeStatus("submit", "Course submitted for review")
              }
              disabled={saving}
            >
              <Send />
              {course.approvalStatus === "REJECTED"
                ? "Resubmit for review"
                : "Submit for review"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Two-column builder */}
      <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Curriculum outline */}
        <aside className="max-h-[calc(100vh-260px)] overflow-y-auto rounded-xl border bg-card lg:max-h-none">
          <div className="flex items-center justify-between border-b p-3">
            <h2 className="font-semibold">Curriculum</h2>
            <Button variant="ghost" size="sm" onClick={openAddModule}>
              <Plus />
              Module
            </Button>
          </div>

          <div className="space-y-3 p-3">
            {course.modules.map((m, mi) => (
              <div
                key={m.id}
                draggable
                onDragStart={() => setDragModule(m.id)}
                onDragEnd={() => setDragModule(null)}
                onDragOver={(e) => {
                  if (!dragModule || dragModule === m.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={() => {
                  if (!dragModule || dragModule === m.id) return;
                  const ids = course.modules.map((x) => x.id);
                  const from = ids.indexOf(dragModule);
                  const to = ids.indexOf(m.id);
                  if (from === -1 || to === -1) return;
                  ids.splice(from, 1);
                  ids.splice(to, 0, dragModule);
                  setDragModule(null);
                  void reorderModules(ids);
                }}
                className={cn(
                  "overflow-hidden rounded-lg border shadow-sm transition-opacity",
                  dragModule === m.id && "opacity-40",
                )}
              >
                {/* Module header */}
                <div
                  className="flex items-center justify-between gap-2 bg-muted px-3 py-2.5 cursor-pointer select-none"
                  onClick={() => toggleModule(m.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="cursor-grab text-muted-foreground active:cursor-grabbing">
                      <GripVertical className="size-4" />
                    </span>
                    <span className="text-muted-foreground">
                      {collapsed.has(m.id) ? (
                        <ChevronRight className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </span>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-primary">
                        Module {mi + 1}
                      </p>
                      <p className="text-sm font-medium">{m.title}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {m.lessons.length}L · {m.quizzes.length}Q
                    </Badge>
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-muted-foreground/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmState({
                          title: `Delete module "${m.title}"?`,
                          description:
                            "This removes the module and all of its lessons and quiz.",
                          action: async () => {
                            await apiFetch(`/api/staff/modules/${m.id}`, {
                              method: "DELETE",
                            });
                            toast("Module deleted", "success");
                            invalidate();
                          },
                        });
                      }}
                      aria-label="Delete module"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>

                {/* Module body */}
                {!collapsed.has(m.id) && (
                  <div className="divide-y">
                    {m.lessons.map((l) => (
                      <button
                        key={l.id}
                        draggable
                        onDragStart={() => setDragLesson(l.id)}
                        onDragEnd={() => setDragLesson(null)}
                        onDragOver={(e) => {
                          if (!dragLesson || dragLesson === l.id) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={() => {
                          if (!dragLesson || dragLesson === l.id) return;
                          const ids = m.lessons.map((x) => x.id);
                          const from = ids.indexOf(dragLesson);
                          const to = ids.indexOf(l.id);
                          if (from === -1 || to === -1) return;
                          ids.splice(from, 1);
                          ids.splice(to, 0, dragLesson);
                          setDragLesson(null);
                          void reorderLessons(m.id, ids);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                          selectedLessonId === l.id && selectedTab === "lesson"
                            ? "bg-primary-fixed"
                            : "hover:bg-muted",
                          dragLesson === l.id && "opacity-40",
                        )}
                        onClick={() => selectLesson(l.id)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="cursor-grab text-muted-foreground active:cursor-grabbing">
                            <GripVertical className="size-3.5" />
                          </span>
                          <PlayCircle
                            className={cn(
                              "size-4 shrink-0",
                              selectedLessonId === l.id
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          />
                          <span className="truncate">{l.title}</span>
                          {l.isFree && (
                            <Badge variant="secondary" className="text-[10px]">
                              Free
                            </Badge>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {l.videoUrl
                            ? formatDuration(l.videoDuration ?? 0)
                            : "Article"}
                        </span>
                      </button>
                    ))}

                    {m.quizzes.map((q) => (
                      <button
                        key={q.id}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                          selectedQuizId === q.id && selectedTab === "quiz"
                            ? "bg-amber-100 dark:bg-amber-900/30"
                            : "hover:bg-muted",
                        )}
                        onClick={() => selectQuiz(q.id)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <HelpCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span className="truncate">{q.title}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {Array.isArray(q.questions) ? q.questions.length : 0} Qs
                        </span>
                      </button>
                    ))}

                    <div className="flex gap-2 p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => openAddLesson(m.id)}
                      >
                        <Plus />
                        Lesson
                      </Button>
                      {m.quizzes.length === 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => void addQuiz(m.id)}
                        >
                          <HelpCircle />
                          Quiz
                        </Button>
                      ) : (
                        <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          <HelpCircle className="size-3.5" />
                          Quiz added
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={openAddModule}
            >
              <Plus />
              New module
            </Button>
          </div>
        </aside>

        {/* Editor panel */}
        <section className="min-w-0">
          <div className="mb-4 flex gap-2 border-b">
            <TabButton
              active={selectedTab === "details"}
              onClick={() => {
                setSelectedTab("details");
                setSelectedLessonId(null);
                setSelectedQuizId(null);
              }}
              icon={<FileText className="size-4" />}
              label="Course details"
            />
            <TabButton
              active={selectedTab === "lesson" && !!selectedLesson}
              disabled={!selectedLesson}
              onClick={() => setSelectedTab("lesson")}
              icon={<PlayCircle className="size-4" />}
              label="Lesson editor"
            />
            <TabButton
              active={selectedTab === "quiz" && !!selectedQuiz}
              disabled={!selectedQuiz}
              onClick={() => setSelectedTab("quiz")}
              icon={<HelpCircle className="size-4" />}
              label="Quiz editor"
            />
            <TabButton
              active={selectedTab === "test"}
              onClick={() => setSelectedTab("test")}
              icon={<ClipboardCheck className="size-4" />}
              label="Test editor"
            />
          </div>

          <div className="rounded-xl border bg-card p-4 md:p-6">
            {selectedTab === "details" && (
              <CourseDetailsForm
                courseId={courseId}
                course={course}
                categories={categoriesQuery.data ?? []}
                onSaved={invalidate}
              />
            )}

            {selectedTab === "lesson" &&
              (activeLesson ? (
                <LessonEditor
                  key={activeLesson.lesson.id}
                  module={activeLesson.module}
                  lesson={activeLesson.lesson}
                  onChanged={invalidate}
                  onDelete={() => {
                    setSelectedLessonId(null);
                    setSelectedTab("details");
                  }}
                />
              ) : (
                <EmptyState
                  icon={<PlayCircle className="size-10 text-muted-foreground" />}
                  title="Select a lesson"
                  hint="Pick a lesson from the curriculum outline to edit its content, video, and article."
                />
              ))}

            {selectedTab === "quiz" &&
              (activeQuiz ? (
                <QuizEditor
                  key={activeQuiz.quiz.id}
                  quiz={activeQuiz.quiz}
                  onChanged={invalidate}
                  onDelete={() => {
                    setSelectedQuizId(null);
                    setSelectedTab("details");
                  }}
                />
              ) : (
                <EmptyState
                  icon={<HelpCircle className="size-10 text-muted-foreground" />}
                  title="Select a quiz"
                  hint="Pick a quiz from the curriculum outline to edit its questions."
                />
              ))}
          {selectedTab === "test" && (
              <TestSection
                courseId={courseId}
                tests={course.tests}
                onChanged={invalidate}
              />
            )}
          </div>
        </section>
      </div>

      {promptOpen && (
        <PromptDialog
          open
          title={
            promptKind === "module" ? "New module title" : "New lesson title"
          }
          description={
            promptKind === "module"
              ? "Group related lessons together. You can add a quiz to this module later."
              : "This lesson will be added to the selected module."
          }
          placeholder={
            promptKind === "module"
              ? "e.g. Introduction"
              : "e.g. What is machine learning?"
          }
          loading={promptLoading}
          onConfirm={(value) => void confirmPrompt(value)}
          onCancel={() => setPromptOpen(false)}
        />
      )}

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? "Confirm"}
        description={confirmState?.description}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        loading={saving}
        onConfirm={() => {
          const action = confirmState?.action;
          setConfirmState(null);
          if (action) void action();
        }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

function TabButton({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {icon}
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

interface LessonEditorProps {
  module: ModuleData;
  lesson: Lesson;
  onChanged: () => void;
  onDelete: () => void;
}

/**
 * Lesson content editor (spec §17).
 *
 * Exactly TWO persisted types: VIDEO and READING; READING has exactly ONE
 * source (rich text OR PDF). The type is persisted server-side — local state
 * here is only the draft. Content payloads are atomic on save, and switching
 * to a type/source that discards existing content asks for confirmation.
 */
function LessonEditor({
  module,
  lesson,
  onChanged,
  onDelete,
}: LessonEditorProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(lesson.title);
  const [type, setType] = useState<"VIDEO" | "READING">(lesson.type ?? "READING");
  const [readingSource, setReadingSource] = useState<"article" | "pdf">(
    lesson.pdfUrl ? "pdf" : "article",
  );
  const [duration, setDuration] = useState(
    lesson.videoDuration ? String(lesson.videoDuration) : "",
  );
  const [article, setArticle] = useState(lesson.article ?? "");
  const [isFree, setIsFree] = useState(lesson.isFree);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<
    null | { nextType: "VIDEO" | "READING"; nextSource?: "article" | "pdf" }
  >(null);

  const hasContent =
    !!lesson.videoUrl || !!lesson.article || !!lesson.pdfUrl;

  const requestSwitch = (
    nextType: "VIDEO" | "READING",
    nextSource?: "article" | "pdf",
  ) => {
    const destructive =
      nextType !== type || (nextType === "READING" && !!nextSource && nextSource !== readingSource);
    if (!destructive || !hasContent) {
      setType(nextType);
      if (nextType === "READING" && nextSource) setReadingSource(nextSource);
      return;
    }
    setPendingSwitch({ nextType, nextSource });
  };

  const save = async () => {
    // Atomic content payload per the server contract.
    let body: Record<string, unknown>;
    if (type === "VIDEO") {
      if (!lesson.videoUrl) {
        toast("Upload a video before saving this lesson", "error");
        return;
      }
      body = {
        title: title.trim(),
        type: "VIDEO",
        videoUrl: lesson.videoUrl,
        article: null,
        pdfUrl: null,
        ...(duration ? { videoDuration: Math.max(0, Number(duration) || 0) } : {}),
        isFree,
      };
    } else if (readingSource === "article") {
      if (!article.trim()) {
        toast("Write some content or switch the reading source", "error");
        return;
      }
      body = {
        title: title.trim(),
        type: "READING",
        article,
        pdfUrl: null,
        videoUrl: null,
        isFree,
      };
    } else {
      if (!lesson.pdfUrl) {
        toast("Upload a PDF before saving this lesson", "error");
        return;
      }
      body = {
        title: title.trim(),
        type: "READING",
        pdfUrl: lesson.pdfUrl,
        article: null,
        videoUrl: null,
        isFree,
      };
    }

    setSaving(true);
    try {
      await apiFetch(`/api/staff/lessons/${lesson.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast("Lesson saved", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Module {module.position + 1} / Lesson {lesson.position + 1}
          </p>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lesson title"
            className="mt-1 h-9 border-none bg-transparent px-0 text-xl font-bold shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          {!hasContent && (
            <Badge variant="warning">Incomplete — add content</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
            Delete
          </Button>
          <ConfirmDialog
            open={deleteOpen}
            title="Delete this lesson?"
            description="This removes the lesson and its media from the module. This action cannot be undone."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            destructive
            onConfirm={() => {
              setDeleteOpen(false);
              void (async () => {
                await apiFetch(`/api/staff/lessons/${lesson.id}`, {
                  method: "DELETE",
                });
                toast("Lesson deleted", "success");
                onDelete();
                onChanged();
              })().catch((err) =>
                toast(
                  err instanceof Error ? err.message : "Delete failed",
                  "error",
                ),
              );
            }}
            onCancel={() => setDeleteOpen(false)}
          />
          <ConfirmDialog
            open={!!pendingSwitch}
            title="Change lesson type?"
            description={
              pendingSwitch
                ? `This lesson already has ${
                    lesson.videoUrl ? "a video" : "reading material"
                  }. Switching will remove it when you save.`
                : ""
            }
            confirmLabel="Switch"
            cancelLabel="Keep current"
            destructive
            onConfirm={() => {
              if (pendingSwitch) {
                setType(pendingSwitch.nextType);
                if (pendingSwitch.nextSource) setReadingSource(pendingSwitch.nextSource);
              }
              setPendingSwitch(null);
            }}
            onCancel={() => setPendingSwitch(null)}
          />
        </div>
      </div>

      {/* Type selector (persisted) */}
      <div>
        <Label className="mb-2 block">Lesson type</Label>
        <div className="grid grid-cols-2 gap-3">
          <TypeCard
            active={type === "VIDEO"}
            onClick={() => requestSwitch("VIDEO")}
            icon={<PlayCircle className="size-6" />}
            label="Video"
          />
          <TypeCard
            active={type === "READING"}
            onClick={() => requestSwitch("READING", readingSource)}
            icon={<FileText className="size-6" />}
            label="Reading"
          />
        </div>
      </div>

      {type === "VIDEO" ? (
        <div className="space-y-4">
          <MediaUploader
            kind="VIDEO"
            lessonId={lesson.id}
            onChanged={onChanged}
          />
          {lesson.videoUrl ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="size-4" /> Video uploaded & verified
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No video yet. Upload an MP4/MOV/WebM file — large files upload in
              resumable chunks directly to storage.
            </p>
          )}
          <div className="space-y-2">
            <Label>Duration (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="auto-detected after upload"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reading source selector: exactly one of rich text / PDF */}
          <div>
            <Label className="mb-2 block">Content source</Label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <TypeCard
                active={readingSource === "article"}
                onClick={() => requestSwitch("READING", "article")}
                icon={<FileText className="size-5" />}
                label="Rich Text"
              />
              <TypeCard
                active={readingSource === "pdf"}
                onClick={() => requestSwitch("READING", "pdf")}
                icon={<FileText className="size-5" />}
                label="PDF"
              />
            </div>
          </div>

          {readingSource === "article" ? (
            <div className="space-y-2">
              <Label>Article content</Label>
              <RichTextEditor value={article} onChange={setArticle} />
            </div>
          ) : (
            <div className="space-y-3">
              <MediaUploader
                kind="PDF"
                lessonId={lesson.id}
                onChanged={onChanged}
              />
              {lesson.pdfUrl ? (
                <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle2 className="size-4" /> PDF uploaded & verified
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Students get a built-in PDF viewer. Maximum size 50 MB.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isFree}
          onChange={(e) => setIsFree(e.target.checked)}
          className="size-4"
        />
        Free preview lesson
      </label>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={() => void save()} disabled={saving}>
          <Save />
          {saving ? "Saving…" : "Save lesson"}
        </Button>
      </div>
    </div>
  );
}

function TypeCard({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all",
        active
          ? "border-primary bg-primary-fixed text-primary ring-1 ring-primary"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

interface QuizEditorProps {
  quiz: Quiz;
  onChanged: () => void;
  onDelete: () => void;
}

function QuizEditor({ quiz, onChanged, onDelete }: QuizEditorProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(quiz.title);
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    Array.isArray(quiz.questions)
      ? (quiz.questions as DraftQuestion[]).map((q) => ({
          question: q.question,
          options: q.options ?? [],
          correctIndex: q.correctIndex ?? 0,
        }))
      : [],
  );
  const [deleteOpen, setDeleteOpen] = useState(false);

  const save = async () => {
    if (!title.trim() || questions.length === 0) {
      toast("Enter a title and at least one question", "error");
      return;
    }
    try {
      await apiFetch(`/api/staff/quizzes/${quiz.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim(), questions }),
      });
      toast("Quiz saved", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quiz title"
          className="h-9 border-none bg-transparent px-0 text-xl font-bold shadow-none focus-visible:ring-0"
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 />
          Delete
        </Button>
        <ConfirmDialog
          open={deleteOpen}
          title="Delete this quiz?"
          description="This removes the quiz from the module. This action cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          destructive
          onConfirm={() => {
            setDeleteOpen(false);
            void (async () => {
              await apiFetch(`/api/staff/quizzes/${quiz.id}`, {
                method: "DELETE",
              });
              toast("Quiz deleted", "success");
              onDelete();
              onChanged();
            })().catch((err) =>
              toast(
                err instanceof Error ? err.message : "Delete failed",
                "error",
              ),
            );
          }}
          onCancel={() => setDeleteOpen(false)}
        />
      </div>

      <QuestionEditor questions={questions} onChange={setQuestions} />

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={() => void save()}>
          <Save />
          Save quiz
        </Button>
      </div>
    </div>
  );
}
