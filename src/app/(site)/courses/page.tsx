import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { BookOpen, Search, SearchX } from "lucide-react";

import {
  listPublishedCourses,
  listCategories,
} from "@/server/services/course.service";

import { getDictionary, type Locale } from "@/i18n/dictionaries";

import { CatalogGrid } from "@/components/catalog/catalog-grid";
import type { CourseCardCourse } from "@/components/course-card";
import { CatalogControls } from "@/components/catalog-controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Course catalog",
  description:
    "Browse all EduPro courses. Filter by category, price, and sort by popularity or rating.",
};

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

function priceKey(minPrice?: number, maxPrice?: number): string {
  if (minPrice === undefined && maxPrice === undefined) return "all";
  if (minPrice === 0 && maxPrice === 0) return "free";
  if (minPrice === undefined && maxPrice === 500) return "under500";
  if (minPrice === 500 && maxPrice === 1500) return "500-1500";
  if (minPrice === 1500 && maxPrice === undefined) return "over1500";
  return "custom";
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const cookieStore = await cookies();
  const localeValue = cookieStore.get("elearning.locale")?.value;
  const locale: Locale = localeValue === "th" ? "th" : "en";
  const t = getDictionary(locale);

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

  const buildUrl = (updates: {
    categories?: string[] | null;
    minPrice?: number | null;
    maxPrice?: number | null;
  }) => {
    const params = new URLSearchParams();

    if (search) {
      params.set("search", search);
    }

    const cats = updates.categories === null ? [] : updates.categories ?? categories;
    cats.forEach((category) => params.append("category", category));

    if (sort !== "NEWEST") {
      params.set("sort", sort);
    }

    if (updates.minPrice !== undefined && updates.minPrice !== null) {
      params.set("minPrice", String(updates.minPrice));
    }

    if (updates.maxPrice !== undefined && updates.maxPrice !== null) {
      params.set("maxPrice", String(updates.maxPrice));
    }

    const queryString = params.toString();

    return queryString ? `/courses?${queryString}` : "/courses";
  };

  const activePrice = priceKey(minPrice, maxPrice);

  const pricePills = [
    { key: "all", label: t.catalog.price.all, min: undefined, max: undefined },
    { key: "free", label: t.catalog.price.free, min: 0, max: 0 },
    { key: "under500", label: t.catalog.price.under500, min: undefined, max: 500 },
    { key: "500-1500", label: t.catalog.price.range, min: 500, max: 1500 },
    { key: "over1500", label: t.catalog.price.over1500, min: 1500, max: undefined },
  ] as const;

  const pageNumbers = getPageNumbers(safePage, totalPages);

  const categoryPill = (isActive: boolean) =>
    cn(
      "whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
      isActive
        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
        : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary",
    );

  const pricePill = (isActive: boolean) =>
    cn(
      "whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
      isActive
        ? "border border-accent/40 bg-accent/20 text-accent"
        : "bg-muted text-muted-foreground hover:bg-accent/10 hover:text-accent",
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* =========================================================
          HERO
      ========================================================== */}

      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 via-accent/5 to-background">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute left-1/2 top-[-12rem] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute left-[-10rem] top-32 h-[400px] w-[400px] rounded-full bg-accent/15 blur-[120px]" />
          <div className="absolute right-[-10rem] top-40 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto flex min-h-[360px] max-w-7xl flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <BookOpen className="h-4 w-4" />
            {t.catalog.explore}
          </div>

          <h1 className="max-w-4xl bg-gradient-to-r from-primary via-violet-600 to-accent bg-clip-text pb-2 text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-6xl">
            {t.catalog.heroTitle}
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base md:text-lg">
            {t.catalog.heroSubtitle}
          </p>

          <form
            action="/courses"
            method="GET"
            className="group relative mt-9 w-full max-w-2xl"
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

            <div className="absolute inset-0 rounded-2xl bg-primary/20 opacity-0 blur-xl transition-opacity duration-300 group-focus-within:opacity-100" />

            <div className="relative flex items-center overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/10 transition-all duration-300 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
              <Search className="ml-4 h-5 w-5 shrink-0 text-muted-foreground" />

              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder={t.catalog.searchPlaceholder}
                className="min-w-0 flex-1 border-none bg-transparent px-4 py-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0 sm:text-base"
              />

              <button
                type="submit"
                className="m-1 rounded-xl bg-gradient-to-r from-primary to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:opacity-90"
              >
                {t.common.search}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* =========================================================
          FILTER BAR
      ========================================================== */}

      <section className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/courses" className={categoryPill(categories.length === 0)}>
              {t.catalog.allCourses}
            </Link>

            {allCategories.map((category) => {
              const isActive = categories.includes(category.id);

              const nextCategories = isActive
                ? categories.filter((id) => id !== category.id)
                : [...categories, category.id];

              return (
                <Link
                  key={category.id}
                  href={buildUrl({ categories: nextCategories })}
                  className={categoryPill(isActive)}
                >
                  {category.name}
                </Link>
              );
            })}

            <span className="mx-1.5 h-5 w-px shrink-0 bg-border" />

            {pricePills.map((pill) => (
              <Link
                key={pill.key}
                href={buildUrl({ minPrice: pill.min, maxPrice: pill.max })}
                className={pricePill(activePrice === pill.key)}
              >
                {pill.label}
              </Link>
            ))}

            <div className="ml-auto flex items-center gap-4">
              <CatalogControls currentSort={sort} />

              <span className="hidden shrink-0 font-mono text-xs font-medium text-muted-foreground md:inline">
                {t.catalog.resultCount(data.total)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          COURSE GRID
      ========================================================== */}

      <main className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8">
        {data.items.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-20 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-accent/15">
              <SearchX className="h-8 w-8 text-primary" />
            </div>

            <h3 className="text-xl font-bold text-foreground">
              {t.catalog.noResultsTitle}
            </h3>

            <p className="mb-6 mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {t.catalog.noResultsSubtitle}
            </p>

            <Button asChild variant="outline">
              <Link href="/courses">{t.catalog.clearFilters}</Link>
            </Button>
          </div>
        ) : (
          <>
            <CatalogGrid
              courses={data.items.map((course) => ({
                ...course,
                moduleCount: course._count?.modules ?? 0,
              })) as CourseCardCourse[]}
            />

            {/* =================================================
                PAGINATION
            ================================================== */}

            {totalPages > 1 && (
              <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-border pt-7 sm:flex-row">
                <div className="font-mono text-xs text-muted-foreground">
                  {t.catalog.showingTo(
                    (safePage - 1) * PAGE_SIZE + 1,
                    Math.min(safePage * PAGE_SIZE, data.total),
                    data.total,
                  )}
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
                        className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
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
        "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 font-mono text-xs font-semibold transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
          : disabled
            ? "cursor-not-allowed text-muted-foreground/40"
            : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary",
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