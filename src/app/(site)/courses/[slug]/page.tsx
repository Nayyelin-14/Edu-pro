import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  Clock,
  Play,
  Star,
  Video,
  FileText,
  ShieldCheck,
  Infinity,
  Globe,
  Calendar,
  BarChart3,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CourseActions } from "@/components/course-actions";
import { CourseCurriculum } from "@/components/course-curriculum";
import { getCoursePage } from "@/server/services/course.service";
import { getSessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/* ─── Helpers ─────────────────────────────────────────────── */

function formatDuration(totalSeconds: number) {
  if (!totalSeconds || totalSeconds <= 0) return "Self-paced";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;

  return `${minutes}m`;
}

function formatLessons(count: number) {
  return `${count} ${count === 1 ? "lesson" : "lessons"}`;
}

function getInitials(name?: string | null) {
  if (!name) return "U";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/* ─── Page ────────────────────────────────────────────────── */

export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;

  let course;

  try {
    course = await getCoursePage(slug);
  } catch {
    notFound();
  }

  const totalLessons = course.modules.reduce(
    (acc, module) => acc + module.lessons.length,
    0,
  );

  const viewer = await getSessionUser();

  const totalDurationSeconds = course.modules.reduce(
    (acc, module) =>
      acc +
      module.lessons.reduce(
        (lessonTotal, lesson) => lessonTotal + (lesson.videoDuration ?? 0),
        0,
      ),
    0,
  );

  const free = (course.price ?? 0) === 0;
  const image = course.coverImage;

  const instructor = (course as { instructor?: { avatar?: string | null; name?: string | null } | null })
    .instructor ?? undefined;

  const rating = Number(course.rating ?? 0);
  const ratingCount = Number(course.ratingCount ?? 0);
  const studentCount = Number(course.studentCount ?? 0);

  const durationLabel = formatDuration(totalDurationSeconds);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#09090b] dark:text-slate-100">
      {/* =========================================================
          TOP NAVIGATION
      ========================================================= */}

      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#09090b]/85">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-5 md:px-10">
          <Link
            href="/courses"
            className="group flex items-center gap-2.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
          >
            <span className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition-all group-hover:border-slate-300 group-hover:shadow dark:border-white/10 dark:bg-white/[0.04] dark:group-hover:border-white/20">
              <ArrowLeft className="size-4" />
            </span>

            <span className="hidden sm:inline">All courses</span>
          </Link>

          <div className="flex items-center gap-2.5">
            {course.category && (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400">
                {course.category.name}
              </span>
            )}

            {course.isFeatured && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                Featured
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* =========================================================
          HERO
      ========================================================= */}

      <header className="relative overflow-hidden border-b border-slate-200/80 bg-white dark:border-white/[0.08] dark:bg-[#09090b]">
        {/* Ambient background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 size-[500px] rounded-full bg-indigo-500/[0.07] blur-3xl dark:bg-indigo-500/[0.09]" />

          <div className="absolute right-0 top-20 size-[400px] rounded-full bg-violet-500/[0.06] blur-3xl dark:bg-violet-500/[0.08]" />
        </div>

        <div className="relative mx-auto grid w-full max-w-[1400px] gap-12 px-5 py-14 md:px-10 lg:grid-cols-12 lg:gap-16 lg:py-20">
          {/* ── Hero content ── */}

          <div className="flex flex-col justify-center lg:col-span-7">
            {/* Rating */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                <Star className="size-4 fill-amber-400 text-amber-400" />

                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {rating.toFixed(1)}
                </span>

                <span className="text-xs text-amber-700/70 dark:text-amber-400/70">
                  {ratingCount.toLocaleString("en-US")} reviews
                </span>
              </div>

              <span className="hidden text-slate-300 dark:text-slate-700 sm:inline">
                •
              </span>

              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {studentCount.toLocaleString("en-US")} students enrolled
              </span>
            </div>

            {/* Title */}

            <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-tight text-slate-950 sm:text-5xl md:text-6xl dark:text-white">
              {course.title}
            </h1>

            {/* Subtitle */}

            {course.subtitle && (
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-400">
                {course.subtitle}
              </p>
            )}

            {/* Course metadata */}

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Lessons */}

              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 dark:border-blue-500/15 dark:bg-blue-500/10">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/15">
                  <BookOpen className="size-4 text-blue-600 dark:text-blue-400" />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600/70 dark:text-blue-400/70">
                    Lessons
                  </p>

                  <p className="truncate text-sm font-bold text-blue-950 dark:text-blue-200">
                    {formatLessons(totalLessons)}
                  </p>
                </div>
              </div>

              {/* Duration */}

              <div className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3 dark:border-violet-500/15 dark:bg-violet-500/10">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/15">
                  <Clock className="size-4 text-violet-600 dark:text-violet-400" />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600/70 dark:text-violet-400/70">
                    Duration
                  </p>

                  <p className="truncate text-sm font-bold text-violet-950 dark:text-violet-200">
                    {durationLabel}
                  </p>
                </div>
              </div>

              {/* Language */}

              <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 dark:border-emerald-500/15 dark:bg-emerald-500/10">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15">
                  <Globe className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600/70 dark:text-emerald-400/70">
                    Language
                  </p>

                  <p className="truncate text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    English
                  </p>
                </div>
              </div>
            </div>

            {/* Instructor */}

            <div className="mt-9 flex items-center gap-4">
              {instructor?.avatar ? (
                <img
                  src={instructor.avatar}
                  alt=""
                  className="size-12 rounded-full border-2 border-white object-cover shadow-md dark:border-white/10"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
                  {getInitials(instructor?.name)}
                </div>
              )}

              <div>
                <p className="text-sm font-bold text-slate-950 dark:text-white">
                  {instructor?.name ?? "Instructor"}
                </p>

                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-500">
                  Course instructor
                </p>
              </div>
            </div>
          </div>

          {/* ── Cover image ── */}

          <div className="relative lg:col-span-5 lg:self-center">
            <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-transparent blur-2xl" />

            <div className="group relative aspect-video overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-2xl shadow-slate-300/30 dark:border-white/10 dark:bg-[#111113] dark:shadow-none">
              {image ? (
                <img
                  src={image}
                  alt={course.title}
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#111113] dark:to-[#18181b]">
                  <BookOpen className="size-16 text-slate-300 dark:text-slate-700" />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" />

              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="flex size-16 items-center justify-center rounded-full bg-white text-slate-900 shadow-2xl transition-transform duration-300 group-hover:scale-110">
                  <Play className="ml-0.5 size-6 fill-current" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================
          MAIN
      ========================================================= */}

      <main className="mx-auto grid w-full max-w-[1400px] gap-10 px-5 py-14 md:px-10 lg:grid-cols-12 lg:gap-16 lg:py-20">
        {/* =====================================================
            LEFT CONTENT
        ===================================================== */}

        <div className="lg:col-span-8">
          {/* ── What you'll learn ── */}

          <section className="mb-16">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/10">
                <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  What you&apos;ll learn
                </h2>

                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Skills you&apos;ll gain from this course
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Master core concepts with hands-on projects",
                "Build real-world applications from scratch",
                "Best practices used by industry professionals",
                "Deploy and scale your work confidently",
              ].map((item, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5 dark:border-white/10 dark:bg-[#111113] dark:hover:border-emerald-500/30"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
                    <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>

                  <span className="text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── About ── */}

          {course.description && (
            <section className="mb-16">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/10">
                  <FileText className="size-5 text-violet-600 dark:text-violet-400" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                    About this course
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Everything you need to know
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10 dark:border-white/10 dark:bg-[#111113]",
                  "[&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-950 dark:[&_h1]:text-white",
                  "[&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-950 dark:[&_h2]:text-white",
                  "[&_h3]:mb-3 [&_h3]:font-bold [&_h3]:text-slate-950 dark:[&_h3]:text-white",
                  "[&_p]:mb-5 [&_p:last-child]:mb-0 [&_p]:leading-8 [&_p]:text-slate-600 dark:[&_p]:text-slate-400",
                  "[&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-white",
                  "[&_a]:font-medium [&_a]:text-indigo-600 [&_a]:underline [&_a]:underline-offset-4 dark:[&_a]:text-indigo-400",
                  "[&_ul]:mb-5 [&_ul]:list-disc [&_ul]:space-y-2.5 [&_ul]:pl-6 [&_ul]:text-slate-600 dark:[&_ul]:text-slate-400",
                  "[&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:space-y-2.5 [&_ol]:pl-6 [&_ol]:text-slate-600 dark:[&_ol]:text-slate-400",
                )}
                dangerouslySetInnerHTML={{
                  __html: course.description,
                }}
              />
            </section>
          )}

          {/* ── Curriculum ── */}

          <section id="curriculum" className="mb-16 scroll-mt-28">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/10">
                    <BookOpen className="size-4 text-blue-600 dark:text-blue-400" />
                  </div>

                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Learning path
                  </span>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Course content
                </h2>

                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                  {course.modules.length} modules ·{" "}
                  {formatLessons(totalLessons)} · {durationLabel}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#111113]">
              <CourseCurriculum modules={course.modules} tests={course.tests} />
            </div>
          </section>

          {/* ── Reviews ── */}

          <section id="reviews" className="scroll-mt-28">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/10">
                  <Star className="size-5 fill-amber-500 text-amber-500" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                    Student reviews
                  </h2>

                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    What students are saying
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2.5">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-5",
                        i < Math.round(rating)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-slate-200 text-slate-200 dark:fill-slate-800 dark:text-slate-800",
                      )}
                    />
                  ))}
                </div>

                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {rating.toFixed(1)}
                </span>

                <span className="text-sm text-slate-400">
                  ({ratingCount.toLocaleString("en-US")})
                </span>
              </div>
            </div>

            {course.reviews.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-white/10 dark:bg-[#111113]">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/[0.05]">
                  <MessageSquare className="size-6 text-slate-400" />
                </div>

                <h3 className="mt-5 text-base font-bold text-slate-900 dark:text-white">
                  No reviews yet
                </h3>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Be the first to share your experience.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {course.reviews.map((review) => {
                  const username = review.user?.username ?? "User";

                  return (
                    <article
                      key={review.id}
                      className="group rounded-3xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-500/5 dark:border-white/10 dark:bg-[#111113] dark:hover:border-amber-500/20"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          {review.user?.avatar ? (
                            <img
                              src={review.user.avatar}
                              alt=""
                              className="size-10 rounded-full border border-slate-200 object-cover dark:border-white/10"
                            />
                          ) : (
                            <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                              {getInitials(username)}
                            </div>
                          )}

                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {username}
                            </p>

                            <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                              ✓ Verified student
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "size-4",
                                i < review.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "fill-slate-200 text-slate-200 dark:fill-slate-800 dark:text-slate-800",
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      {review.content && (
                        <p className="mt-5 text-sm leading-7 text-slate-600 dark:text-slate-400">
                          {review.content}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* =====================================================
            RIGHT SIDEBAR
        ===================================================== */}

        <aside className="lg:col-span-4">
          <div className="sticky top-24 space-y-5">
            {/* ── Enrollment card ── */}

            <div className="overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-2xl shadow-indigo-500/10 dark:border-indigo-500/20 dark:bg-[#111113] dark:shadow-none">
              {/* Gradient accent */}

              <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

              <div className="p-7">
                {/* Price */}

                <div className="mb-7">
                  {free && (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                      Free course
                    </span>
                  )}

                  <div className="mt-3 flex items-baseline gap-2">
                    {free ? (
                      <span className="text-4xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                        Free
                      </span>
                    ) : (
                      <>
                        <span className="text-lg font-bold text-slate-500">
                          $
                        </span>

                        <span className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                          {course.price}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    One-time payment · Lifetime access
                  </p>
                </div>

                {/* Actions */}

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

                {/* Includes */}

                <div className="mt-8 rounded-2xl bg-slate-50 p-5 dark:bg-white/[0.03]">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500">
                    This course includes
                  </p>

                  <div className="space-y-4">
                    {[
                      {
                        icon: Infinity,
                        label: "Lifetime access",
                        color: "text-indigo-500 dark:text-indigo-400",
                      },
                      {
                        icon: Award,
                        label: "Completion certificate",
                        color: "text-amber-500 dark:text-amber-400",
                      },
                      {
                        icon: Video,
                        label: `${formatLessons(totalLessons)} on demand`,
                        color: "text-blue-500 dark:text-blue-400",
                      },
                      {
                        icon: FileText,
                        label: "Downloadable resources",
                        color: "text-violet-500 dark:text-violet-400",
                      },
                      {
                        icon: ShieldCheck,
                        label: "30-day guarantee",
                        color: "text-emerald-500 dark:text-emerald-400",
                      },
                    ].map(({ icon: Icon, label, color }) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300"
                      >
                        <Icon className={cn("size-4 shrink-0", color)} />

                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom information */}

              <div className="border-t border-slate-200 bg-slate-50/80 px-7 py-4 dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-500 dark:text-slate-500">
                  <span className="flex items-center gap-2">
                    <Calendar className="size-3.5" />
                    Updated recently
                  </span>

                  <span className="flex items-center gap-2">
                    <BarChart3 className="size-3.5" />
                    All levels
                  </span>
                </div>
              </div>
            </div>

            {/* ── Report ── */}

            <div className="flex items-center justify-center">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-600 dark:hover:bg-white/[0.05] dark:hover:text-white"
              >
                <Link href={viewer ? `/${viewer.id}/reports?courseId=${course.id}` : `/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`}>
                  Report this course
                </Link>
              </Button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
