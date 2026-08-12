import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Circle, CheckCircle2, MessageCircle, Settings, ChevronDown, ChevronRight, FileQuestion } from "lucide-react";
import { isEnrolled } from "@/server/services/enrollment.service";
import { getCourseForLearning } from "@/server/services/course.service";
import { requireUser } from "@/server/guards";
import { fromJson } from "@/lib/json";
import type { QuestionShape } from "@/types/content";
import { LessonView } from "@/components/learning/lesson-view";
import { CurriculumSidebar } from "@/components/learning/curriculum-sidebar";
import { QuizRunner } from "@/components/learning/quiz-runner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lesson?: string; quiz?: string }>;
}

export default async function LearningPage({ params, searchParams }: PageProps) {
  const [{ courseId }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser();

  const enrolled = await isEnrolled(user.id, courseId);
  if (!enrolled) redirect("/");

  const { course, completedLessonIds } = await getCourseForLearning(
    courseId,
    user.id,
  );
  const completedSet = new Set(completedLessonIds);

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const allLessonsMeta = allLessons.map((l) => ({
    id: l.id,
    title: l.title,
    isFree: l.isFree,
    videoDuration: l.videoDuration,
    modulePosition: course.modules.findIndex((m) => m.lessons.some((ll) => ll.id === l.id)),
    position: l.position,
  }));
  const totalLessons = allLessons.length;
  const completedCount = completedLessonIds.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const selectedLessonId = sp.lesson ?? null;
  const selectedQuizId = sp.quiz ?? null;

  const selectedLesson = selectedLessonId
    ? allLessons.find((l) => l.id === selectedLessonId) ?? null
    : null;
  const selectedQuiz = selectedQuizId
    ? course.modules.flatMap((m) => m.quizzes).find((q) => q.id === selectedQuizId) ?? null
    : null;

  // Build lesson list for navigation
  const lessonNavList = allLessons.map((l) => ({
    id: l.id,
    title: l.title,
    isFree: l.isFree,
    videoDuration: l.videoDuration,
    modulePosition: course.modules.findIndex((m) => m.lessons.some((ll) => ll.id === l.id)),
    position: l.position,
  }));

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <header className="h-[72px] bg-card border-b border-border flex-none flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <Link
            href={`/courses/${course.slug}`}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center rounded-full p-2 hover:bg-accent"
            aria-label="Back to course"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="h-8 w-px bg-border mx-2" />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
              Course Player
            </p>
            <h1 className="text-lg font-bold text-foreground truncate max-w-xs">
              {course.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="hidden md:flex items-center gap-3 bg-muted px-4 py-2 rounded-full">
            <div className="w-32 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-foreground">{progressPercent}% Complete</span>
          </div>

          {/* Discussion Button */}
          <Button variant="outline" size="sm" className="gap-2">
            <MessageCircle className="size-4" />
            Discussion
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Settings className="size-5" />
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Curriculum Sidebar */}
        <CurriculumSidebar
          modules={course.modules}
          tests={course.tests}
          completedLessonIds={completedLessonIds}
          courseId={courseId}
          currentLessonId={selectedLessonId ?? undefined}
          currentQuizId={selectedQuizId ?? undefined}
        />

        {/* Main Content */}
        <main className="flex-1 bg-background overflow-y-auto custom-scrollbar relative min-w-0">
          {selectedQuiz ? (
            <QuizRunner
              quizId={selectedQuiz.id}
              title={selectedQuiz.title}
              questions={fromJson<QuestionShape[]>(selectedQuiz.questions).map(
                ({ id, question, options }) => ({ id, question, options }),
              )}
              onClose={() => {
                // Navigation handled by sidebar links
              }}
            />
          ) : selectedLesson ? (
            <LessonView
              courseId={courseId}
              lesson={{
                id: selectedLesson.id,
                title: selectedLesson.title,
                videoUrl: selectedLesson.videoUrl,
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
              onMarkComplete={() => {
                // Router refresh handled in component
              }}
            />
          ) : (
            <div className="max-w-4xl mx-auto p-8 lg:p-12 pb-32 space-y-8">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-foreground mb-4">{course.title}</h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  {completedCount} of {totalLessons} lessons completed.
                  {progressPercent > 0 && <span className="text-primary ml-2">({progressPercent}%)</span>}
                </p>
                {allLessons.length > 0 && (
                  <Button asChild size="lg" className="mt-6">
                    <Link href={`/learning/${courseId}?lesson=${allLessons[0]!.id}`}>
                      <ChevronRight className="size-4 mr-2" />
                      Start Learning
                    </Link>
                  </Button>
                )}
              </div>

              {course.tests.length > 0 && (
                <div className="space-y-4 border-t border-border pt-8">
                  <h2 className="text-xl font-semibold text-foreground">Final Tests</h2>
                  {course.tests.map((test) => (
                    <Link
                      key={test.id}
                      href={`/learning/${courseId}/test/${test.id}`}
                      className="flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-accent transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <FileQuestion className="size-6" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{test.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {test.timeLimitMinutes} min · {test.attemptLimit} attempt{test.attemptLimit === 1 ? "" : "s"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}