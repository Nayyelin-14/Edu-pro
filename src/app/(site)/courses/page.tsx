import Link from "next/link";
import { BookOpen, Search, SearchX, SlidersHorizontal } from "lucide-react";

import {
  listPublishedCourses,
  listCategories,
} from "@/server/services/course.service";

import { CourseCard, type CourseCardCourse } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category?: string | string[];
    sort?: string;
    page?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
}

const PAGE_SIZE = 8;

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const search = sp.search?.trim() ?? "";
  const categories = toArray(sp.category);

  const rawSort = sp.sort;

  const sort =
    rawSort === "POPULAR" || rawSort === "RATING" || rawSort === "PRICE_ASC"
      ? rawSort
      : "NEWEST";

  const minPrice =
    sp.minPrice && !Number.isNaN(Number(sp.minPrice))
      ? Number(sp.minPrice)
      : undefined;

  const maxPrice =
    sp.maxPrice && !Number.isNaN(Number(sp.maxPrice))
      ? Number(sp.maxPrice)
      : undefined;

  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [data, allCategories] = await Promise.all([
    listPublishedCourses({
      search,
      categories: categories.length ? categories : undefined,
      minPrice,
      maxPrice,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),

    listCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageLink = (p: number) => {
    const params = new URLSearchParams();

    if (search) {
      params.set("search", search);
    }

    categories.forEach((category) => {
      params.append("category", category);
    });

    if (sort !== "NEWEST") {
      params.set("sort", sort);
    }

    if (minPrice !== undefined) {
      params.set("minPrice", String(minPrice));
    }

    if (maxPrice !== undefined) {
      params.set("maxPrice", String(maxPrice));
    }

    if (p > 1) {
      params.set("page", String(p));
    }

    const queryString = params.toString();

    return queryString ? `/courses?${queryString}` : "/courses";
  };

  const pageNumbers = getPageNumbers(safePage, totalPages);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#080b16] dark:text-slate-100">
      {/* =========================================================
          HERO
      ========================================================== */}

      <section className="relative overflow-hidden border-b border-violet-200/60 bg-gradient-to-b from-violet-100 via-indigo-50 to-slate-50 dark:border-white/5 dark:from-[#16102c] dark:via-[#0d1020] dark:to-[#080b16]">
        {/* Light mode decorative glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute left-1/2 top-[-14rem] h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-violet-400/20 blur-[120px] dark:bg-violet-600/15" />

          <div className="absolute left-[-12rem] top-40 h-[450px] w-[450px] rounded-full bg-blue-400/15 blur-[120px] dark:bg-blue-500/10" />

          <div className="absolute right-[-10rem] top-48 h-[500px] w-[500px] rounded-full bg-cyan-400/15 blur-[120px] dark:bg-cyan-400/5" />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.08),transparent_55%)] dark:bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.08),transparent_55%)]" />
        </div>

        <div className="relative mx-auto flex min-h-[480px] max-w-[1280px] flex-col items-center justify-center px-4 py-20 text-center md:px-8">
          {/* Badge */}

          <div className="mb-6 flex items-center gap-2 rounded-full border border-violet-300 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 shadow-sm backdrop-blur-xl dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200">
            <BookOpen className="h-4 w-4" />
            Explore EduPro
          </div>

          {/* Heading */}

          <h1 className="max-w-4xl bg-gradient-to-r from-violet-700 via-indigo-600 to-cyan-600 bg-clip-text pb-2 text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-6xl lg:text-[64px] lg:leading-[72px] dark:from-[#d2bbff] dark:via-[#f1e9ff] dark:to-[#4cd7f6]">
            Elevate Your Skills
          </h1>

          <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base md:text-lg dark:text-slate-400">
            Master modern technologies in an immersive, focused environment. No
            noise, just pure learning flow.
          </p>

          {/* Search */}

          <form
            action="/courses"
            method="GET"
            className="group relative mt-8 w-full max-w-2xl"
          >
            {categories.map((category) => (
              <input
                key={category}
                type="hidden"
                name="category"
                value={category}
              />
            ))}

            {sort !== "NEWEST" && (
              <input type="hidden" name="sort" value={sort} />
            )}

            {minPrice !== undefined && (
              <input type="hidden" name="minPrice" value={minPrice} />
            )}

            {maxPrice !== undefined && (
              <input type="hidden" name="maxPrice" value={maxPrice} />
            )}

            <div className="absolute inset-0 rounded-2xl bg-violet-400/20 opacity-0 blur-xl transition-opacity duration-300 group-focus-within:opacity-100 dark:bg-cyan-400/10" />

            <div className="relative flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-xl shadow-violet-500/10 transition-all duration-300 focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:border-white/10 dark:bg-[#060e20]/90 dark:shadow-2xl dark:focus-within:border-cyan-400">
              <Search className="ml-4 h-5 w-5 shrink-0 text-slate-400 dark:text-[#958da1]" />

              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search courses, skills, or topics..."
                className="min-w-0 flex-1 border-none bg-transparent px-4 py-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 sm:text-base dark:text-[#dae2fd] dark:placeholder:text-[#958da1]"
              />

              <button
                type="submit"
                className="m-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:from-violet-700 hover:to-indigo-700"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* =========================================================
          FILTER BAR
      ========================================================== */}

      <section className="sticky top-0 z-40 w-full border-y border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur-xl dark:border-white/5 dark:bg-[#080b16]/85 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] md:px-8">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href="/courses"
            className={cn(
              "whitespace-nowrap rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-all",
              categories.length === 0
                ? "border-violet-300 bg-violet-100 text-violet-700 shadow-sm dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-200"
                : "border-slate-200 bg-slate-100 text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white",
            )}
          >
            All Courses
          </Link>

          {allCategories.map((category) => {
            const isActive = categories.includes(category.id);

            const params = new URLSearchParams();

            if (search) {
              params.set("search", search);
            }

            const nextCategories = isActive
              ? categories.filter((id) => id !== category.id)
              : [...categories, category.id];

            nextCategories.forEach((id) => {
              params.append("category", id);
            });

            if (sort !== "NEWEST") {
              params.set("sort", sort);
            }

            if (minPrice !== undefined) {
              params.set("minPrice", String(minPrice));
            }

            if (maxPrice !== undefined) {
              params.set("maxPrice", String(maxPrice));
            }

            const href = params.toString()
              ? `/courses?${params.toString()}`
              : "/courses";

            return (
              <Link
                key={category.id}
                href={href}
                className={cn(
                  "whitespace-nowrap rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-all",
                  isActive
                    ? "border-cyan-300 bg-cyan-50 text-cyan-700 shadow-sm dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300"
                    : "border-slate-200 bg-slate-100 text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white",
                )}
              >
                {category.name}
              </Link>
            );
          })}

          <div className="ml-auto hidden shrink-0 items-center gap-2 border-l border-slate-200 pl-5 md:flex dark:border-white/10">
            <SlidersHorizontal className="h-4 w-4 text-slate-400 dark:text-slate-500" />

            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {data.total} {data.total === 1 ? "course" : "courses"}
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================
          COURSE GRID
      ========================================================== */}

      <main className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-8">
        {data.items.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm dark:border-white/10 dark:bg-[#111827]/70 dark:backdrop-blur-xl">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-cyan-100 dark:from-violet-500/10 dark:to-cyan-500/10">
              <SearchX className="h-8 w-8 text-violet-500 dark:text-violet-300" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              No courses found
            </h3>

            <p className="mb-6 mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
              We couldn&apos;t find any courses matching your current filters
              and search query. Try adjusting your criteria.
            </p>

            <Button
              asChild
              className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
              variant="outline"
            >
              <Link href="/courses">Clear All Filters</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.items.map((course) => (
                <EduProCourseCard
                  key={course.id}
                  course={course as unknown as CourseCardCourse}
                />
              ))}
            </div>

            {/* =================================================
                PAGINATION
            ================================================== */}

            {totalPages > 1 && (
              <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-slate-200 pt-7 sm:flex-row dark:border-white/10">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Showing{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-200">
                    {(safePage - 1) * PAGE_SIZE + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-200">
                    {Math.min(safePage * PAGE_SIZE, data.total)}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-200">
                    {data.total}
                  </span>{" "}
                  courses
                </div>

                <div className="flex items-center gap-2">
                  <PaginationButton
                    href={safePage > 1 ? pageLink(safePage - 1) : undefined}
                    disabled={safePage <= 1}
                  >
                    ‹
                  </PaginationButton>

                  {pageNumbers.map((item, index) =>
                    item === "..." ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="flex h-9 w-9 items-center justify-center text-sm text-slate-400"
                      >
                        …
                      </span>
                    ) : (
                      <PaginationButton
                        key={item}
                        href={item !== safePage ? pageLink(item) : undefined}
                        active={item === safePage}
                      >
                        {item}
                      </PaginationButton>
                    ),
                  )}

                  <PaginationButton
                    href={
                      safePage < totalPages ? pageLink(safePage + 1) : undefined
                    }
                    disabled={safePage >= totalPages}
                  >
                    ›
                  </PaginationButton>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ============================================================
   COURSE CARD
============================================================ */

function EduProCourseCard({ course }: { course: CourseCardCourse }) {
  return (
    <div className="group relative h-full">
      <CourseCard course={course} />
    </div>
  );
}
/* ============================================================
   PAGINATION BUTTON
============================================================ */

function PaginationButton({
  href,
  active,
  disabled,
  children,
}: {
  href?: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href ?? "#"}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      className={cn(
        "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm transition-all",
        active
          ? "border-violet-300 bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-700 shadow-sm dark:border-violet-400/30 dark:from-violet-500/20 dark:to-indigo-500/20 dark:text-violet-200"
          : disabled
            ? "cursor-not-allowed border-slate-100 text-slate-300 dark:border-white/5 dark:text-slate-600"
            : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400 dark:hover:border-violet-400/30 dark:hover:bg-violet-500/10 dark:hover:text-violet-200",
      )}
    >
      {children}
    </Link>
  );
}

/* ============================================================
   PAGINATION RANGE
============================================================ */

function getPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

/* ============================================================
   LOADING SKELETON
============================================================ */

export function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0b1326]/70"
        >
          <Skeleton className="h-48 w-full rounded-none bg-slate-100 dark:bg-white/5" />

          <div className="space-y-4 p-5">
            <Skeleton className="h-4 w-1/3 bg-slate-100 dark:bg-white/5" />

            <Skeleton className="h-6 w-3/4 bg-slate-100 dark:bg-white/5" />

            <Skeleton className="h-4 w-full bg-slate-100 dark:bg-white/5" />

            <Skeleton className="h-4 w-2/3 bg-slate-100 dark:bg-white/5" />

            <div className="border-t border-slate-100 pt-4 dark:border-white/10">
              <Skeleton className="h-4 w-1/2 bg-slate-100 dark:bg-white/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
