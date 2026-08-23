import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Award, ChevronRight, FileQuestion } from "lucide-react";
import { isEnrolled } from "@/server/services/enrollment.service";
import { resolveTenantContext } from "@/server/tenant-context";
import { getCourseForLearning } from "@/server/services/course.service";
import { requireUserRedirect } from "@/server/guards";
import { fromJson } from "@/lib/json";
import type { QuestionShape } from "@/types/content";
import { LessonView } from "@/components/learning/lesson-view";
import { CurriculumSidebar } from "@/components/learning/curriculum-sidebar";
import { QuizRunner } from "@/components/learning/quiz-runner";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lesson?: string; quiz?: string }>;
}

export default async function LearningPage({
  params,
  searchParams,
}: PageProps) {
  const [{ courseId }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUserRedirect(`/learning/${courseId}`);
  const ctx = await resolveTenantContext(user);

  const enrolled = await isEnrolled(user.id, courseId, ctx.tenant.id);
  if (!enrolled) redirect("/");

  const { course, completedLessonIds } = await getCourseForLearning(ctx, courseId);
  const completedSet = new Set(completedLessonIds);

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const totalLessons = allLessons.length;
  const completedCount = completedLessonIds.length;
  const progressPercent =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const selectedLessonId = sp.lesson ?? null;
  const selectedQuizId = sp.quiz ?? null;

  const selectedLesson = selectedLessonId
    ? (allLessons.find((l) => l.id === selectedLessonId) ?? null)
    : null;
  const selectedQuiz = selectedQuizId
    ? (course.modules
        .flatMap((m) => m.quizzes)
        .find((q) => q.id === selectedQuizId) ?? null)
    : null;

  const currentModule = selectedLesson
    ? (course.modules.find((m) =>
        m.lessons.some((ll) => ll.id === selectedLesson.id),
      ) ?? null)
    : null;
  const takeQuiz =
    selectedLesson && currentModule && currentModule.quizzes.length > 0
      ? currentModule.quizzes[0]
      : null;
  const selectedLessonIndex = selectedLesson
    ? allLessons.findIndex((l) => l.id === selectedLesson.id)
    : -1;

  // Build lesson list for navigation
  const lessonNavList = allLessons.map((l) => ({
    id: l.id,
    title: l.title,
    isFree: l.isFree,
    videoDuration: l.videoDuration,
    modulePosition: course.modules.findIndex((m) =>
      m.lessons.some((ll) => ll.id === l.id),
    ),
    position: l.position,
  }));

  // Resume: first lesson the learner hasn't completed yet. When they come
  // back to the course without a specific lesson/quiz selected, jump straight
  // there so progress is never lost and learning continues where it stopped.
  const resumeLesson = allLessons.find((l) => !completedSet.has(l.id)) ?? null;

  if (
    !selectedLesson &&
    !selectedQuiz &&
    progressPercent > 0 &&
    progressPercent < 100 &&
    resumeLesson
  ) {
    redirect(`/learning/${courseId}?lesson=${resumeLesson.id}`);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Top Navigation */}
      <header className="h-16 flex-none z-30 bg-card">
        <div className="mx-auto flex h-full w-full  items-center justify-between gap-3 px-4 ">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/courses/${course.slug}`}
              className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center rounded-full p-2 hover:bg-accent flex-none"
              aria-label="Back to course"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="h-8 w-px bg-border flex-none" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5 truncate">
                {course.title}
                {selectedLesson && currentModule
                  ? ` · Module ${currentModule.position}`
                  : ""}
              </p>
              <h1 className="font-bold text-foreground text-base truncate">
                {selectedLesson?.title ?? selectedQuiz?.title ?? course.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-none">
            {selectedLesson && (
              <span className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-xl font-mono">
                Lesson {selectedLessonIndex + 1} / {totalLessons}
              </span>
            )}
            {selectedQuiz && (
              <span className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-xl font-mono">
                Quiz
              </span>
            )}
            {takeQuiz && !selectedQuiz && (
              <Button
                asChild
                size="sm"
                className="gap-1.5 shadow-md shadow-primary/30"
              >
                <Link href={`/learning/${courseId}?quiz=${takeQuiz.id}`}>
                  <Award className="size-3.5" />
                  Take Quiz
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
          <main className="min-w-0 overflow-y-auto custom-scrollbar">
            {selectedQuiz ? (
              <div className="max-w-2xl mx-auto p-4 lg:p-8">
                <QuizRunner
                  quizId={selectedQuiz.id}
                  title={selectedQuiz.title}
                  questions={fromJson<QuestionShape[]>(
                    selectedQuiz.questions,
                  ).map(({ id, question, options }) => ({
                    id,
                    question,
                    options,
                  }))}
                  onClose={() => {
                    // Navigation handled by sidebar links
                  }}
                />
              </div>
            ) : selectedLesson ? (
              <div className="p-4 lg:p-6">
                <div className="max-w-5xl mx-auto">
                  <LessonView
                    courseId={courseId}
                    lesson={{
                      id: selectedLesson.id,
                      title: selectedLesson.title,
                      // Persisted type is authoritative for rendering.
                      type: selectedLesson.type,
                      // Private media is resolved at request time via signed
                      // URLs; raw references never reach the client.
                      hasPdf: !!selectedLesson.pdfUrl,
                      article: selectedLesson.article,
                      videoDuration: selectedLesson.videoDuration,
                      position: selectedLesson.position,
                      modulePosition: course.modules.findIndex((m) =>
                        m.lessons.some((ll) => ll.id === selectedLesson.id),
                      ),
                      isFree: selectedLesson.isFree,
                    }}
                    initiallyCompleted={completedSet.has(selectedLesson.id)}
                    allLessons={lessonNavList}
                  />
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto p-8 lg:p-12 pb-32 space-y-8">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-foreground mb-4">
                    {course.title}
                  </h1>
                  <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    {completedCount} of {totalLessons} lessons completed.
                    {progressPercent > 0 && (
                      <span className="text-primary ml-2">
                        ({progressPercent}%)
                      </span>
                    )}
                  </p>
                  {allLessons.length > 0 && (
                    <Button asChild size="lg" className="mt-6">
                      <Link
                        href={`/learning/${courseId}?lesson=${
                          resumeLesson?.id ?? allLessons[0]!.id
                        }`}
                      >
                        <ChevronRight className="size-4 mr-2" />
                        {progressPercent === 100
                          ? "Review Course"
                          : progressPercent > 0
                            ? "Continue Learning"
                            : "Start Learning"}
                      </Link>
                    </Button>
                  )}
                </div>

                {course.tests.length > 0 && (
                  <div className="space-y-4 border-t border-border pt-8">
                    <h2 className="text-xl font-semibold text-foreground">
                      Final Tests
                    </h2>
                    {course.tests.map((test) => (
                      <Link
                        key={test.id}
                        href={`/learning/${courseId}/test/${test.id}`}
                        className="flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-accent transition-colors"
                      >
                        <div className="w-12 h-12 rounded-lg bg-primary-container/10 text-primary flex items-center justify-center">
                          <FileQuestion className="size-6" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {test.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {test.timeLimitMinutes} min · {test.attemptLimit}{" "}
                            attempt{test.attemptLimit === 1 ? "" : "s"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>

          <CurriculumSidebar
            modules={course.modules}
            tests={course.tests}
            completedLessonIds={completedLessonIds}
            courseId={courseId}
            currentLessonId={selectedLessonId ?? undefined}
            currentQuizId={selectedQuizId ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}
