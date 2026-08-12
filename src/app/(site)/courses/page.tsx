import Link from "next/link";
import { SearchX } from "lucide-react";
import { listPublishedCourses, listCategories } from "@/server/services/course.service";
import { CourseCard, type CourseCardCourse } from "@/components/course-card";
import { CatalogControls, type CatalogSort } from "@/components/catalog-controls";
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

const PAGE_SIZE = 12;

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const categories = toArray(sp.category);
  const rawSort = sp.sort;
  const sort: CatalogSort =
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

  const pageLink = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    categories.forEach((c) => params.append("category", c));
    if (sort !== "NEWEST") params.set("sort", sort);
    if (minPrice !== undefined) params.set("minPrice", String(minPrice));
    if (maxPrice !== undefined) params.set("maxPrice", String(maxPrice));
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/courses?${qs}` : "/courses";
  };

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-8 md:px-8">
      <CatalogControls
        categories={allCategories.map((c) => ({
          id: c.id,
          name: c.name,
          count: c._count.courses,
        }))}
        activeCategories={categories}
        search={search}
        minPrice={minPrice !== undefined ? String(minPrice) : ""}
        maxPrice={maxPrice !== undefined ? String(maxPrice) : ""}
        sort={sort}
        totalResults={data.total}
      >
        {/* Grid */}
        {data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
              <SearchX className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No courses found</h3>
            <p className="mb-6 mt-2 max-w-md text-sm text-muted-foreground">
              We couldn&apos;t find any courses matching your current filters and
              search query. Try adjusting your criteria.
            </p>
            <Button asChild variant="outline">
              <Link href="/courses">Clear All Filters</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((course) => (
              <CourseCard
                key={course.id}
                course={course as unknown as CourseCardCourse}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
            <span className="hidden text-sm text-muted-foreground sm:block">
              Showing{" "}
              {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, data.total)} of {data.total} results
            </span>
            <div className="flex items-center gap-2">
              <PaginationButton href={page > 1 ? pageLink(page - 1) : undefined} disabled={page <= 1}>
                ‹
              </PaginationButton>
              {pageNumbers.map((p) => (
                <PaginationButton
                  key={p}
                  href={p !== page ? pageLink(p) : undefined}
                  active={p === page}
                >
                  {p}
                </PaginationButton>
              ))}
              <PaginationButton
                href={page < totalPages ? pageLink(page + 1) : undefined}
                disabled={page >= totalPages}
              >
                ›
              </PaginationButton>
            </div>
          </div>
        )}
      </CatalogControls>
    </div>
  );
}

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
        "flex size-8 items-center justify-center rounded border text-sm transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : disabled
            ? "cursor-not-allowed border-border text-muted-foreground/50"
            : "border-border text-foreground hover:border-primary hover:text-primary",
      )}
    >
      {children}
    </Link>
  );
}

/** Loading skeleton for the catalog grid (client-safe, no data needed). */
export function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border">
          <Skeleton className="h-[180px] w-full rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
