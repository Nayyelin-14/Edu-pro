import Link from "next/link";
import { CheckCircle2, PlayCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface CourseProgressData {
  course: {
    id: string;
    slug: string;
    title: string;
    coverImage: string | null;
    category?: { id: string; name: string } | null;
  };
  progress: { completedLessons: number; totalLessons: number; percent: number };
}

interface CourseProgressCardProps {
  enrollment: CourseProgressData;
  className?: string;
}

export function CourseProgressCard({
  enrollment,
  className,
}: CourseProgressCardProps) {
  const { course, progress } = enrollment;
  const completed = progress.totalLessons > 0 && progress.percent === 100;
  const inProgress = progress.percent > 0 && !completed;
  const actionLabel = completed
    ? "Review course"
    : inProgress
      ? "Continue learning"
      : "Start course";

  return (
    <Link
      href={`/learning/${course.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-lowest transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-surface-container">
        {course.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.coverImage}
            alt={course.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-primary-container/10">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontSize: "56px" }}
              aria-hidden="true"
            >
              school
            </span>
          </div>
        )}
        {completed && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-success text-success-foreground px-2.5 py-1 text-label-sm font-semibold">
            <CheckCircle2 className="size-3.5" />
            Done
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-on-surface/20 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col p-4">
        {course.category?.name && (
          <p className="mb-1 text-label-sm font-medium uppercase tracking-wide text-primary">
            {course.category.name}
          </p>
        )}
        <h3 className="line-clamp-2 text-title-lg font-semibold text-on-surface">
          {course.title}
        </h3>

        <div className="mt-auto pt-4">
          <div className="mb-1.5 flex items-center justify-between text-label-sm text-on-surface-variant">
            <span>{completed ? "100%" : `${progress.percent}%`}</span>
            <span>
              {progress.completedLessons} / {progress.totalLessons} lessons
            </span>
          </div>
          <Progress
            value={progress.percent}
            className="h-2"
            indicatorClassName={completed ? "bg-success" : "bg-primary"}
          />
          <span
            className={cn(
              "mt-3 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-label-md font-semibold transition-colors",
              completed
                ? "border border-outline-variant text-on-surface hover:bg-surface-container"
                : "bg-primary-container text-on-primary-container hover:bg-primary hover:text-primary-foreground",
            )}
          >
            <PlayCircle className="size-4" aria-hidden="true" />
            {actionLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}