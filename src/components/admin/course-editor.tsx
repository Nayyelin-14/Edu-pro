"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  GripVertical,
  PlayCircle,
  Plus,
  Save,
  Trash2,
  FileText,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDuration } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { CourseDetailsForm } from "@/components/admin/course-details-form";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  QuestionEditor,
  type DraftQuestion,
} from "@/components/admin/question-editor";

interface Lesson {
  id: string;
  title: string;
  videoUrl: string | null;
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
  category: { id: string; name: string } | null;
  modules: ModuleData[];
  tests: {
    id: string;
    title: string;
    description: string | null;
    passingScore: number;
    timeLimitMinutes: number;
    attemptLimit: number;
    isEnabled: boolean;
  }[];
}

type EditorTab = "lesson" | "quiz" | "details";

export function CourseEditor({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<EditorTab>("lesson");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [dragLesson, setDragLesson] = useState<string | null>(null);
  const [dragModule, setDragModule] = useState<string | null>(null);

  const courseQuery = useQuery({
    queryKey: ["admin-course", courseId],
    queryFn: () => apiFetch<AdminCourse>(`/api/admin/courses/${courseId}`),
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

  const togglePublish = async () => {
    if (!courseQuery.data) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          isPublished: !courseQuery.data.isPublished,
        }),
      });
      toast(
        courseQuery.data.isPublished ? "Course unpublished" : "Course published",
        "success",
      );
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  };

  const addModule = async () => {
    const title = prompt("New module title");
    if (!title?.trim()) return;
    try {
      await apiFetch("/api/admin/modules", {
        method: "POST",
        body: JSON.stringify({ courseId, title: title.trim() }),
      });
      toast("Module added", "success");
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const addLesson = async (moduleId: string) => {
    const title = prompt("New lesson title");
    if (!title?.trim()) return;
    try {
      await apiFetch("/api/admin/lessons", {
        method: "POST",
        body: JSON.stringify({ moduleId, title: title.trim() }),
      });
      toast("Lesson added", "success");
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  const addQuiz = async (moduleId: string) => {
    try {
      await apiFetch("/api/admin/quizzes", {
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
      await applyOrder(items, (id) => `/api/admin/lessons/${id}`);
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
      await applyOrder(items, (id) => `/api/admin/modules/${id}`);
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
            <Badge variant={course.isPublished ? "success" : "secondary"}>
              {course.isPublished ? "Published" : "Draft"}
            </Badge>
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
          <Button size="sm" onClick={() => void togglePublish()} disabled={saving}>
            {course.isPublished ? "Unpublish" : "Publish course"}
          </Button>
        </div>
      </div>

      {/* Two-column builder */}
      <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Curriculum outline */}
        <aside className="max-h-[calc(100vh-260px)] overflow-y-auto rounded-xl border bg-card lg:max-h-none">
          <div className="flex items-center justify-between border-b p-3">
            <h2 className="font-semibold">Curriculum</h2>
            <Button variant="ghost" size="sm" onClick={() => void addModule()}>
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
                        if (confirm(`Delete module "${m.title}" and all its content?`)) {
                          void (async () => {
                            await apiFetch(`/api/admin/modules/${m.id}`, {
                              method: "DELETE",
                            });
                            toast("Module deleted", "success");
                            invalidate();
                          })().catch((err) =>
                            toast(
                              err instanceof Error ? err.message : "Delete failed",
                              "error",
                            ),
                          );
                        }
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
                        onClick={() => void addLesson(m.id)}
                      >
                        <Plus />
                        Lesson
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => void addQuiz(m.id)}
                      >
                        <HelpCircle />
                        Quiz
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => void addModule()}
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
          </div>
        </section>
      </div>
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

function LessonEditor({
  module,
  lesson,
  onChanged,
  onDelete,
}: LessonEditorProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(lesson.title);
  const [type, setType] = useState<"video" | "article">(
    lesson.videoUrl ? "video" : "article",
  );
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? "");
  const [duration, setDuration] = useState(
    lesson.videoDuration ? String(lesson.videoDuration) : "",
  );
  const [article, setArticle] = useState(lesson.article ?? "");
  const [isFree, setIsFree] = useState(lesson.isFree);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/lessons/${lesson.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          videoUrl:
            type === "video" && videoUrl.trim()
              ? videoUrl.trim()
              : null,
          videoDuration:
            type === "video" && duration
              ? Math.max(0, Number(duration) || 0)
              : undefined,
          article: type === "article" ? article || null : undefined,
          isFree,
        }),
      });
      toast("Lesson saved", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  };

  const uploadVideo = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "lessons");
      const res = await apiFetch<{ url: string }>("/api/uploads", {
        method: "POST",
        body: formData,
      });
      setVideoUrl(res.url);
      setType("video");
      toast("Video uploaded", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
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
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => {
              if (!confirm("Delete this lesson?")) return;
              await apiFetch(`/api/admin/lessons/${lesson.id}`, {
                method: "DELETE",
              });
              toast("Lesson deleted", "success");
              onDelete();
              onChanged();
            }}
          >
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      {/* Type selector */}
      <div>
        <Label className="mb-2 block">Lesson type</Label>
        <div className="grid grid-cols-2 gap-3">
          <TypeCard
            active={type === "video"}
            onClick={() => setType("video")}
            icon={<PlayCircle className="size-6" />}
            label="Video"
          />
          <TypeCard
            active={type === "article"}
            onClick={() => setType("article")}
            icon={<FileText className="size-6" />}
            label="Article"
          />
        </div>
      </div>

      {type === "video" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Video URL</Label>
            <div className="flex gap-2">
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://res.cloudinary.com/..."
              />
              <Button
                variant="outline"
                disabled={uploading}
                onClick={() =>
                  document.getElementById("video-upload")?.click()
                }
              >
                {uploading ? "Uploading…" : "Upload"}
              </Button>
              <input
                id="video-upload"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadVideo(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Duration (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="320"
            />
          </div>
          {videoUrl && (
            <div className="overflow-hidden rounded-xl border">
              <video
                src={videoUrl}
                controls
                className="aspect-video w-full bg-black"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Article content</Label>
          <RichTextEditor value={article} onChange={setArticle} />
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

  const save = async () => {
    if (!title.trim() || questions.length === 0) {
      toast("Enter a title and at least one question", "error");
      return;
    }
    try {
      await apiFetch(`/api/admin/quizzes/${quiz.id}`, {
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
          onClick={async () => {
            if (!confirm("Delete this quiz?")) return;
            await apiFetch(`/api/admin/quizzes/${quiz.id}`, {
              method: "DELETE",
            });
            toast("Quiz deleted", "success");
            onDelete();
            onChanged();
          }}
        >
          <Trash2 />
          Delete
        </Button>
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
