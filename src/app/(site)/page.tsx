import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Play,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { getDictionary } from "@/i18n/dictionaries";
import { CourseCard, type CourseCardCourse } from "@/components/course-card";
import { Button } from "@/components/ui/button";

import {
  listPublishedCourses,
  listCategories,
} from "@/server/services/course.service";

export const dynamic = "force-dynamic";

const categoryThemes = [
  {
    gradient: "from-violet-500 via-purple-500 to-indigo-600",
    glow: "bg-violet-300/40",
    icon: BookOpen,
  },
  {
    gradient: "from-cyan-400 via-blue-500 to-indigo-600",
    glow: "bg-cyan-300/40",
    icon: Zap,
  },
  {
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    glow: "bg-emerald-300/40",
    icon: Users,
  },
  {
    gradient: "from-orange-400 via-rose-500 to-pink-600",
    glow: "bg-orange-300/40",
    icon: Sparkles,
  },
  {
    gradient: "from-fuchsia-500 via-purple-500 to-violet-600",
    glow: "bg-fuchsia-300/40",
    icon: Play,
  },
];

export default async function HomePage() {
  const t = getDictionary("en");

  const [featured, categories] = await Promise.all([
    listPublishedCourses({
      sort: "POPULAR",
      page: 1,
      pageSize: 6,
    }),

    listCategories(),
  ]);

  return (
    <main className="overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#080b16] dark:text-white">
      {/* =========================================================
          HERO
      ========================================================== */}

      <section className="relative isolate overflow-hidden border-b border-violet-200/50 bg-gradient-to-br from-violet-50 via-indigo-50 to-cyan-50 dark:border-white/5 dark:from-[#0f0920] dark:via-[#0b1020] dark:to-[#07131b]">
        {/* Light/Dark glows */}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute left-[10%] top-[-15rem] h-[35rem] w-[35rem] rounded-full bg-violet-400/20 blur-[120px] dark:bg-violet-600/20" />

          <div className="absolute right-[-8rem] top-[8rem] h-[32rem] w-[32rem] rounded-full bg-cyan-400/20 blur-[120px] dark:bg-blue-600/15" />

          <div className="absolute bottom-[-12rem] left-[40%] h-[30rem] w-[30rem] rounded-full bg-fuchsia-400/15 blur-[120px] dark:bg-fuchsia-600/10" />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.12),transparent_35%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.12),transparent_35%)]" />
        </div>

        {/* Grid */}

        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(99,102,241,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.7) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-5 pb-24 pt-20 sm:px-8 sm:pb-28 sm:pt-28 lg:px-10 lg:pb-32">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
            {/* LEFT */}

            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/70 px-4 py-2 text-sm font-medium text-violet-700 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-white/80">
                <span className="flex h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,1)] dark:bg-violet-400" />
                Learn something that moves you forward
              </div>

              <h1 className="max-w-4xl bg-gradient-to-r from-violet-700 via-indigo-600 to-cyan-600 bg-clip-text text-5xl font-bold leading-[1.05] tracking-[-0.04em] text-transparent sm:text-6xl lg:text-7xl dark:from-white dark:via-violet-100 dark:to-cyan-300">
                {t.home.heroTitle}
              </h1>

              <p className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg dark:text-white/60">
                {t.home.heroSubtitle}
              </p>

              {/* Buttons */}

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:from-violet-700 hover:to-indigo-700 dark:shadow-[0_0_40px_rgba(139,92,246,.25)]"
                >
                  <Link href="/courses">
                    {t.home.exploreCourses}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-xl border-slate-200 bg-white/70 px-6 font-medium text-slate-700 shadow-sm backdrop-blur-md hover:bg-white hover:text-violet-700 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <Link href="/about">
                    <Play className="mr-2 h-4 w-4 fill-current" />
                    {t.home.learnMore}
                  </Link>
                </Button>
              </div>

              {/* Trust */}

              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-500 dark:text-white/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                  Practical courses
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-500 dark:text-violet-400" />
                  Learn at your pace
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-violet-400" />
                  Build real skills
                </div>
              </div>
            </div>

            {/* RIGHT VISUAL */}

            <div className="relative hidden lg:block">
              <div className="relative mx-auto aspect-square max-w-[480px]">
                {/* Outer glow */}

                <div className="absolute inset-[8%] rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-cyan-400 opacity-30 blur-3xl dark:from-violet-500 dark:via-purple-600 dark:to-blue-600 dark:opacity-60" />

                {/* Orb */}

                <div className="absolute inset-[15%] rounded-full bg-gradient-to-br from-violet-500 via-purple-600 to-blue-600 opacity-90 shadow-2xl dark:opacity-80" />

                <div className="absolute inset-[20%] rounded-full bg-white/80 shadow-[0_0_100px_rgba(139,92,246,.25)] backdrop-blur-xl dark:bg-[#0c0a12] dark:shadow-[0_0_100px_rgba(139,92,246,.45)]" />

                {/* Center */}

                <div className="absolute inset-[30%] flex flex-col items-center justify-center rounded-full border border-violet-200 bg-white/60 text-center shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/4">
                  <Sparkles className="mb-3 h-8 w-8 text-violet-600 dark:text-violet-300" />

                  <span className="text-sm font-medium text-slate-500 dark:text-white/50">
                    YOUR NEXT
                  </span>

                  <span className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    SKILL
                  </span>

                  <span className="text-2xl font-bold text-violet-600 dark:text-violet-300">
                    STARTS HERE
                  </span>
                </div>

                {/* Floating card */}

                <div className="absolute left-0 top-[18%] rounded-2xl border border-violet-200 bg-white/80 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.07]">
                  <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-300" />

                  <p className="mt-2 text-xs text-slate-500 dark:text-white/50">
                    Learn
                  </p>

                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    New skills
                  </p>
                </div>

                {/* Floating card */}

                <div className="absolute bottom-[18%] right-0 rounded-2xl border border-cyan-200 bg-white/80 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.07]">
                  <Zap className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />

                  <p className="mt-2 text-xs text-slate-500 dark:text-white/50">
                    Practice
                  </p>

                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Real projects
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fade */}

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50 to-transparent dark:from-[#080b16] dark:to-transparent" />
      </section>

      {/* =========================================================
          FEATURED COURSES
      ========================================================== */}

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400">
              <span className="h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,.5)]" />
              POPULAR RIGHT NOW
            </div>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t.home.featured}
            </h2>

            <p className="mt-3 max-w-xl text-slate-500 dark:text-muted-foreground">
              {t.home.featuredSubtitle}
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="w-fit rounded-xl border-violet-200 bg-white hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <Link href="/courses">
              {t.common.viewAll}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {featured.items.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((course) => (
              <div
                key={course.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-500/10 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-violet-400/30"
              >
                <CourseCard course={course as unknown as CourseCardCourse} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50 p-16 text-center dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.01]">
            <BookOpen className="mx-auto h-10 w-10 text-violet-500 dark:text-muted-foreground" />

            <h3 className="mt-4 text-lg font-semibold">
              No courses available yet
            </h3>

            <p className="mt-2 text-sm text-slate-500 dark:text-muted-foreground">
              Check back soon for new learning content.
            </p>
          </div>
        )}
      </section>

      {/* =========================================================
          FEATURE STRIP
      ========================================================== */}

      <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-indigo-50 to-cyan-50 text-slate-900 dark:from-[#0b0912] dark:via-[#0d1020] dark:to-[#07131b] dark:text-white">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-400/20 blur-[100px] dark:bg-violet-600/15" />

        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
              Why learn here
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              More than watching videos.
              <br />
              <span className="text-slate-500 dark:text-white/50">
                Build skills you can actually use.
              </span>
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-3xl border border-violet-200 bg-violet-100 md:grid-cols-3 dark:border-white/10 dark:bg-white/10">
            {/* Learn */}

            <div className="bg-white/70 p-7 transition-colors hover:bg-white dark:bg-white/[0.035] dark:hover:bg-white/[0.06]">
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                <BookOpen className="h-5 w-5" />
              </div>

              <h3 className="text-xl font-semibold">Learn</h3>

              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/50">
                Follow structured courses and build a strong understanding of
                the topics that matter.
              </p>
            </div>

            {/* Practice */}

            <div className="bg-white/70 p-7 transition-colors hover:bg-white dark:bg-white/[0.035] dark:hover:bg-white/[0.06]">
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300">
                <Play className="h-5 w-5" />
              </div>

              <h3 className="text-xl font-semibold">Practice</h3>

              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/50">
                Turn concepts into practical knowledge through focused learning
                experiences.
              </p>
            </div>

            {/* Grow */}

            <div className="bg-white/70 p-7 transition-colors hover:bg-white dark:bg-white/[0.035] dark:hover:bg-white/[0.06]">
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Zap className="h-5 w-5" />
              </div>

              <h3 className="text-xl font-semibold">Grow</h3>

              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/50">
                Keep developing your skills and move toward your next personal
                or professional goal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          CATEGORIES
      ========================================================== */}

      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
          <div className="mb-10 flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
              Explore
            </p>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Find your direction
            </h2>

            <p className="max-w-xl text-slate-500 dark:text-muted-foreground">
              Browse our learning categories and choose where you want to go
              next.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category, index) => {
              const theme = categoryThemes[index % categoryThemes.length];

              const isLarge = index % 5 === 0;

              const Icon = theme?.icon || BookOpen;

              return (
                <Link
                  key={category.id}
                  href={`/courses?category=${category.id}`}
                  className={`group relative min-h-[220px] overflow-hidden rounded-3xl bg-gradient-to-br ${theme?.gradient} p-6 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-500/20 ${
                    isLarge ? "sm:col-span-2 lg:col-span-2" : ""
                  }`}
                >
                  {/* Glow */}

                  <div
                    className={`absolute -right-16 -top-16 h-48 w-48 rounded-full ${theme?.glow} blur-3xl transition-transform duration-500 group-hover:scale-150`}
                  />

                  {/* Circle */}

                  <div className="absolute -bottom-16 -right-8 h-40 w-40 rounded-full border border-white/20" />

                  <div className="relative flex h-full flex-col justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="mt-16">
                      <h3 className="text-xl font-bold">{category.name}</h3>

                      <div className="mt-3 flex items-center text-sm font-medium text-white/70 transition-colors group-hover:text-white">
                        Explore courses
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================================================
          FINAL CTA
      ========================================================== */}

      <section className="px-5 pb-20 sm:px-8 lg:px-10">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-600 px-6 py-20 text-center text-white shadow-2xl shadow-violet-500/20 sm:px-12 dark:from-[#0b0912] dark:via-[#14102a] dark:to-[#07131b] dark:shadow-none">
          <div className="absolute left-1/2 top-1/2 h-96 w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-[100px] dark:bg-violet-600/20" />

          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-xl backdrop-blur-xl dark:bg-gradient-to-br dark:from-violet-500 dark:to-indigo-600 dark:shadow-[0_0_40px_rgba(139,92,246,.35)]">
              <Sparkles className="h-6 w-6" />
            </div>

            <h2 className="mt-7 text-3xl font-bold tracking-tight sm:text-5xl">
              Ready to learn something new?
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-white/75">
              Explore the courses, choose a topic, and start building your next
              skill today.
            </p>

            <Button
              asChild
              size="lg"
              className="mt-9 h-12 rounded-xl bg-white px-7 font-semibold text-violet-700 shadow-xl hover:bg-white/90"
            >
              <Link href="/courses">
                Browse all courses
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
