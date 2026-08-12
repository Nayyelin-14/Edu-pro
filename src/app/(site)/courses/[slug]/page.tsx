import { notFound } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourseActions } from "@/components/course-actions";
import { CourseCurriculum } from "@/components/course-curriculum";
import { getCoursePage } from "@/server/services/course.service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;
  let course;
  try {
    course = await getCoursePage(slug);
  } catch {
    notFound();
  }

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalDurationSeconds = course.modules.reduce(
    (acc, m) => acc + m.lessons.reduce((a, l) => a + (l.videoDuration ?? 0), 0),
    0,
  );
  const free = (course.price ?? 0) === 0;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-8 md:px-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Left content area */}
        <div className="flex w-full flex-col gap-8 lg:w-3/4">
          {/* Hero / bento card */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 md:p-8">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
              aria-hidden
            />
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {course.category && (
                  <Badge
                    variant="secondary"
                    className="uppercase tracking-wider"
                  >
                    {course.category.name}
                  </Badge>
                )}
                {course.isFeatured && <Badge>Featured</Badge>}
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {course.title}
              </h1>

              {course.subtitle && (
                <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
                  {course.subtitle}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">
                    {course.rating.toFixed(1)}
                  </span>
                  <span>
                    ({course.ratingCount} review{course.ratingCount === 1 ? "" : "s"})
                  </span>
                </span>
                <span>{course.studentCount.toLocaleString("en-US")} enrolled</span>
                <span>{totalLessons} lessons</span>
              </div>
            </div>
          </div>

          {/* Overview */}
          {course.description ? (
            <section className="rounded-xl border border-border bg-card p-6 md:p-8">
              <h2 className="border-b border-border pb-3 text-xl font-semibold tracking-tight">
                Course Overview
              </h2>
              <div
                className="mt-4 space-y-4 leading-relaxed text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: course.description }}
              />            </section>
          ) : null}

          {/* Curriculum */}
          <section className="rounded-xl border border-border bg-card p-6 md:p-8">
            <CourseCurriculum
              modules={course.modules}
              tests={course.tests}
            />
          </section>

          {/* Reviews */}
          <section className="rounded-xl border border-border bg-card p-6 md:p-8">
            <h2 className="border-b border-border pb-3 text-xl font-semibold tracking-tight">
              Reviews
            </h2>
            {course.reviews.length === 0 ? (
              <p className="mt-4 text-muted-foreground">No reviews yet.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {course.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        {review.user?.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={review.user.avatar}
                            alt=""
                            className="size-8 rounded-full border border-border object-cover"
                          />
                        ) : null}
                        {review.user?.username ?? "User"}
                      </span>
                      <span className="text-amber-500">
                        {"★".repeat(review.rating)}
                        <span className="text-muted-foreground">
                          {"★".repeat(5 - review.rating)}
                        </span>
                      </span>
                    </div>
                    {review.content && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {review.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right sticky panel */}
        <div className="w-full lg:w-1/4">
          <div
            className={cn("flex flex-col gap-4 lg:sticky lg:top-24")}
          >
            <CourseActions
              courseId={course.id}
              slug={course.slug}
              isFree={free}
              price={course.price ?? 0}
              coverImage={course.coverImage}
              studentCount={course.studentCount}
              totalLessons={totalLessons}
              totalDurationSeconds={totalDurationSeconds}
              rating={course.rating}
              ratingCount={course.ratingCount}
            />
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href={`/reports?courseId=${course.id}`}>Report course</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
