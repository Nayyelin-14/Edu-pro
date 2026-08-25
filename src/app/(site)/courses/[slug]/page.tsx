import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  Clock,
  MessageSquare,
  Star,
  Users,
} from "lucide-react";

import { getDictionary, type Locale } from "@/i18n/dictionaries";

import { Button } from "@/components/ui/button";
import { CourseActions } from "@/components/course-actions";
import { CheckoutReturnHandler } from "@/components/checkout-return-handler";
import { CourseCurriculum } from "@/components/course-curriculum";
import { ReviewForm } from "@/components/review-form";
import { PreviewProvider } from "@/components/video-preview-provider";
import { HeroPreviewButton } from "@/components/hero-preview-button";
import { Reveal } from "@/components/reveal";
import { getCoursePage } from "@/server/services/course.service";
import { resolveTenantContext } from "@/server/tenant-context";
import {
  getEnrollmentProgress,
} from "@/server/services/enrollment.service";
import { isWishlisted } from "@/server/services/wishlist.service";
import { getCompletedLessonIds } from "@/server/services/enrollment.service";
import { getSessionUser } from "@/lib/auth";
import { cn, courseGradient } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const course = await getCoursePage(slug);
    const description =
      course.subtitle ??
      (course.description
        ? course.description.replace(/<[^>]+>/g, " ").slice(0, 160)
        : "Enroll in this EduPro course and earn a certificate.");

    return {
      title: course.title,
      description,
      openGraph: {
        title: course.title,
        description,
        type: "website",
        url: `/courses/${course.slug}`,
        ...(course.coverImage
          ? { images: [{ url: course.coverImage, width: 1200, height: 630 }] }
          : {}),
      },
      twitter: {
        card: "summary_large_image",
        title: course.title,
        description,
        ...(course.coverImage ? { images: [course.coverImage] } : {}),
      },
    };
  } catch {
    return {
      title: "Course not found",
      robots: { index: false },
    };
  }
}

/* ─── Helpers ─────────────────────────────────────────────── */

function formatDuration(totalSeconds: number, selfPacedLabel: string) {
  if (!totalSeconds || totalSeconds <= 0) return selfPacedLabel;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;

  return `${minutes}m`;
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

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i <= Math.floor(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-white/25 text-white/25",
          )}
        />
      ))}
    </span>
  );
}

/* ─── Page ────────────────────────────────────────────────── */

export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const viewer = await getSessionUser();
  const allowPreview =
    !!viewer &&
    (viewer.role === "INSTRUCTOR" || viewer.role === "SUPERADMIN");

  let course;

  try {
    course = await getCoursePage(
      slug,
      allowPreview ? { allowUnpublished: true } : undefined,
    );
  } catch {
    notFound();
  }

  const cookieStore = await cookies();
  const localeValue = cookieStore.get("elearning.locale")?.value;
  const locale: Locale = localeValue === "th" ? "th" : "en";
  const t = getDictionary(locale);

  const totalLessons = course.modules.reduce(
    (acc, module) => acc + module.lessons.length,
    0,
  );

  let initialEnrolled = false;
  let initialSaved = false;
  let initialProgress: number | null = null;
  let completedLessonIds: string[] = [];
  if (viewer) {
    // Tenant-scoped personalization: resolved via canonical TenantContext.
    const ctx = await resolveTenantContext(viewer);
    const [enrollment, saved] = await Promise.all([
      getEnrollmentProgress(ctx, course.id),
      isWishlisted(ctx, course.id),
    ]);
    initialEnrolled = enrollment !== null;
    initialProgress = enrollment?.percent ?? null;
    initialSaved = saved;
    if (initialEnrolled) {
      completedLessonIds = await getCompletedLessonIds(ctx, course.id);
    }
  }

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
  const instructor = course.instructor ?? undefined;
  const gradient = courseGradient(course.category?.name ?? course.id);

  const rating = Number(course.rating ?? 0);
  const ratingCount = Number(course.ratingCount ?? 0);
  const studentCount = Number(course.studentCount ?? 0);

  const durationLabel = formatDuration(totalDurationSeconds, t.course.selfPaced);
  const lessonsLabel = t.course.lessonCount(totalLessons);

  const firstFreeLessonId = course.modules
    .flatMap((m) => m.lessons)
    .find((l) => l.isFree)?.id;

  return (
   <PreviewProvider>
      <div className="min-h-screen bg-background text-foreground">
        <CheckoutReturnHandler courseId={course.id} slug={course.slug} />

        {/* =========================================================
            TOP NAVIGATION
        ========================================================= */}

      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link
            href="/courses"
            className="group flex items-center gap-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-card shadow-sm transition-all group-hover:border-primary/40 group-hover:text-primary">
              <ArrowLeft className="size-4" />
            </span>

            <span className="hidden sm:inline">{t.course.allCourses}</span>
          </Link>

          <div className="flex items-center gap-2">
            {course.category && (
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {course.category.name}
              </span>
            )}

            {course.isFeatured && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-bold text-accent">
                <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                {t.course.featured}
              </span>
            )}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        {/* =========================================================
            HERO
        ========================================================= */}

        <Reveal>
          <header className="group relative overflow-hidden rounded-3xl border border-border shadow-xl shadow-primary/5">
            {/* Background: cover image with a legibility gradient, or a brand
                gradient when there is no cover. */}
            {image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/25" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-transparent to-transparent mix-blend-multiply" />
              </>
            ) : (
              <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
            )}

            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

            <div className="relative grid items-center gap-8 p-8 sm:p-10 lg:grid-cols-3 lg:gap-10 lg:p-14">
              <div className="lg:col-span-2">
                {/* Badges */}
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    {course.category?.name ?? "Course"}
                  </span>

                  {free && (
                    <span className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                      {t.course.freeCourse}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="max-w-3xl text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {course.title}
                </h1>

                {/* Subtitle */}
                {course.subtitle && (
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
                    {course.subtitle}
                  </p>
                )}

                {/* Meta */}
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
                  <span className="flex items-center gap-2">
                    <Stars rating={rating} />
                    <span className="font-mono font-semibold text-white">
                      {rating.toFixed(1)}
                    </span>
                    {ratingCount > 0 && (
                      <span className="text-white/60">
                        ({ratingCount.toLocaleString("en-US")})
                      </span>
                    )}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {t.course.studentsEnrolled(studentCount)}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {durationLabel}
                  </span>
                </div>

                {/* Instructor */}
                <div className="mt-7 flex items-center gap-3">
                  {instructor?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={instructor.avatar}
                      alt=""
                      className="size-10 rounded-full border-2 border-white/40 object-cover"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white backdrop-blur-sm">
                      {getInitials(instructor?.username ?? "EduPro")}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-semibold text-white">
                      {instructor?.username ?? t.course.instructor}
                    </p>
                    <p className="text-xs text-white/60">
                      {t.course.courseInstructor}
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating preview card */}
              <div className="flex items-center justify-center lg:justify-end">
                <div className="group/card relative aspect-video w-full max-w-md overflow-hidden rounded-3xl border border-white/20 shadow-2xl">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={course.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-white/10">
                      <BookOpen className="size-12 text-white/80" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-foreground">
                      Preview
                    </span>
                    <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white">
                      {free
                        ? t.course.freeCourse
                        : `฿${Number(course.price ?? 0).toLocaleString("en-US")}`}
                    </span>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <HeroPreviewButton courseId={course.id} lessonId={firstFreeLessonId} />
                  </div>
                </div>
              </div>
            </div>
          </header>
        </Reveal>

        {/* =========================================================
            MAIN
        ========================================================= */}

        <main className="grid gap-10 py-10 lg:grid-cols-12 lg:gap-12">
          {/* ── LEFT CONTENT ── */}

          <div className="lg:col-span-8">
            {/* What you'll learn */}
            <Reveal>
              <section className="mb-10">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    {t.course.whatYoullLearn}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.course.whatYoullLearnSubtitle}
                  </p>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {t.course.learnItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                        <span className="text-sm leading-relaxed text-foreground">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </Reveal>

            {/* About */}
            {course.description && (
              <Reveal>
                <section className="mb-10">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    {t.course.aboutThisCourse}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.course.aboutThisCourseSubtitle}
                  </p>

                  <div
                    className={cn(
                      "mt-6 rounded-3xl border border-border bg-card p-7",
                      "[&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-foreground",
                      "[&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground",
                      "[&_h3]:mb-3 [&_h3]:font-bold [&_h3]:text-foreground",
                      "[&_p]:mb-5 [&_p:last-child]:mb-0 [&_p]:leading-8 [&_p]:text-muted-foreground",
                      "[&_strong]:font-semibold [&_strong]:text-foreground",
                      "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
                      "[&_ul]:mb-5 [&_ul]:list-disc [&_ul]:space-y-2.5 [&_ul]:pl-6 [&_ul]:text-muted-foreground",
                      "[&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:space-y-2.5 [&_ol]:pl-6 [&_ol]:text-muted-foreground",
                    )}
                    dangerouslySetInnerHTML={{
                      __html: course.description,
                    }}
                  />
                </section>
              </Reveal>
            )}

            {/* Curriculum */}
            <Reveal>
              <section id="curriculum" className="mb-10 scroll-mt-24">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <BookOpen className="size-4 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {t.course.learningPath}
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                      {t.course.courseContent}
                    </h2>

                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {t.course.modulesCount(course.modules.length)} ·{" "}
                      {lessonsLabel} · {durationLabel}
                    </p>
                  </div>
                </div>

                <CourseCurriculum
                  modules={course.modules}
                  tests={course.tests}
                  courseId={course.id}
                  completedLessonIds={completedLessonIds}
                />
              </section>
            </Reveal>

            {/* Reviews */}
            <Reveal>
              <section id="reviews" className="scroll-mt-24">
                <div className="mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
                      <Star className="size-5 fill-amber-500 text-amber-500" />
                    </div>

                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        {t.course.studentReviews}
                      </h2>

                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {t.course.studentReviewsSubtitle}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2.5">
                    <Stars rating={rating} />
                    <span className="text-sm font-bold text-foreground">
                      {rating.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({ratingCount.toLocaleString("en-US")})
                    </span>
                  </div>
                </div>

                {course.reviews.length === 0 ? (
                  <div className="rounded-3xl border border-border bg-card p-12 text-center">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted">
                      <MessageSquare className="size-6 text-muted-foreground" />
                    </div>

                    <h3 className="mt-5 text-base font-bold text-foreground">
                      {t.course.noReviewsYet}
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                      {t.course.noReviewsSubtitle}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-border bg-card">
                    {course.reviews.map((review, i) => {
                      const username = review.user?.username ?? "User";

                      return (
                        <div
                          key={review.id}
                          className={cn(
                            "p-6",
                            i > 0 && "border-t border-border/70",
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                              {review.user?.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={review.user.avatar}
                                  alt=""
                                  className="size-10 rounded-full border border-border object-cover"
                                />
                              ) : (
                                <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-primary text-xs font-bold text-white">
                                  {getInitials(username)}
                                </div>
                              )}

                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  {username}
                                </p>

                                <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                                  ✓ {t.course.verifiedStudent}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5">
                              <Stars rating={review.rating} />
                              <span className="text-xs text-muted-foreground">
                                {new Date(review.createdAt).toLocaleDateString(
                                  locale === "th" ? "th-TH" : "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                          </div>

                          {review.content && (
                            <p className="mt-4 text-sm leading-7 text-muted-foreground">
                              {review.content}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <ReviewForm courseId={course.id} />
              </section>
            </Reveal>
          </div>

          {/* ── RIGHT SIDEBAR ── */}

          <aside className="lg:col-span-4">
            <div className="sticky top-20 space-y-5">
              {/* Enrollment card */}
              <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-primary/5">
                <div className="h-1.5 bg-gradient-to-r from-primary via-violet-500 to-accent" />

                <div className="p-5">
                  {/* Price */}
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {free ? t.common.free : `฿${Number(course.price ?? 0).toLocaleString("en-US")}`}
                    </span>

                    {free && (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {t.course.freeCourse}
                      </span>
                    )}
                  </div>

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
                    initialSignedIn={viewer !== null}
                    initialEnrolled={initialEnrolled}
                    initialProgress={initialProgress}
                    initialSaved={initialSaved}
                  />
                </div>

                {/* Includes */}
                <div className="border-t border-border px-5 py-5">
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t.course.thisCourseIncludes}
                  </p>

                  <div className="grid grid-cols-1 gap-3.5">
                    {[
                      { label: t.course.lifetimeAccess, color: "text-primary" },
                      { label: t.course.completionCertificate, color: "text-amber-500" },
                      { label: t.course.lessonsOnDemand(totalLessons), color: "text-blue-500" },
                      { label: t.course.downloadableResources, color: "text-violet-500" },
                      { label: t.course.thirtyDayGuarantee, color: "text-emerald-500" },
                      { label: t.course.language, color: "text-cyan-500" },
                    ].map(({ label, color }) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 text-sm font-medium text-foreground"
                      >
                        <CheckCircle className={cn("size-4 shrink-0", color)} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Report */}
                <div className="border-t border-border px-5 py-3">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                  >
                    <Link
                      href={
                        viewer
                          ? `/${viewer.id}/reports?courseId=${course.id}`
                          : `/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`
                      }
                    >
                      <MessageSquare className="size-4" />
                      {t.course.reportThisCourse}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
   </PreviewProvider>
  );
}