"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CatalogSort = "NEWEST" | "POPULAR" | "RATING" | "PRICE_ASC";

export interface CatalogCategory {
  id: string;
  name: string;
  count: number;
}

interface CatalogControlsProps {
  categories: CatalogCategory[];
  activeCategories: string[];
  search: string;
  minPrice: string;
  maxPrice: string;
  sort: CatalogSort;
  totalResults: number;
  children: React.ReactNode;
}

const SORT_LABELS: Record<CatalogSort, string> = {
  NEWEST: "Newest Arrivals",
  POPULAR: "Most Popular",
  RATING: "Highest Rated",
  PRICE_ASC: "Price: Low to High",
};

function FilterBody({
  categories,
  activeCategories,
  minPrice,
  maxPrice,
  onToggleCategory,
  onClearAll,
  onApplyPrice,
}: {
  categories: CatalogCategory[];
  activeCategories: string[];
  minPrice: string;
  maxPrice: string;
  onToggleCategory: (id: string) => void;
  onClearAll: () => void;
  onApplyPrice: (min: string, max: string) => void;
}) {
  const [min, setMin] = useState(minPrice);
  const [max, setMax] = useState(maxPrice);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Filters</h2>
        <button
          type="button"
          onClick={onClearAll}
          className="text-sm font-medium text-primary hover:underline"
        >
          Clear all
        </button>
      </div>

      {/* Categories */}
      <div className="border-b border-border pb-5">
        <h3 className="mb-3 text-sm font-bold text-foreground">Categories</h3>
        <div className="space-y-2">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
          {categories.map((c) => (
            <label
              key={c.id}
              className="group flex cursor-pointer items-center gap-2"
            >
              <input
                type="checkbox"
                checked={activeCategories.includes(c.id)}
                onChange={() => onToggleCategory(c.id)}
                className="size-4 cursor-pointer rounded border-input text-primary focus:ring-primary"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground">
                {c.name} ({c.count})
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-foreground">Price Range</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            onBlur={() => onApplyPrice(min, max)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="number"
            min={0}
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            onBlur={() => onApplyPrice(min, max)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => onApplyPrice(min, max)}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

export function CatalogControls({
  categories,
  activeCategories,
  search,
  minPrice,
  maxPrice,
  sort,
  totalResults,
  children,
}: CatalogControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const buildParams = (patch: {
    categories?: string[];
    search?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: CatalogSort;
    page?: string;
  }) => {
    const params = new URLSearchParams();
    const cats = patch.categories ?? activeCategories;
    const nextSort = patch.sort ?? sort;
    const nextMin = patch.minPrice !== undefined ? patch.minPrice : minPrice;
    const nextMax = patch.maxPrice !== undefined ? patch.maxPrice : maxPrice;
    if (patch.search !== undefined && patch.search) {
      params.set("search", patch.search);
    } else if (patch.search === undefined && search) {
      params.set("search", search);
    }
    if (nextMin) params.set("minPrice", nextMin);
    if (nextMax) params.set("maxPrice", nextMax);
    if (nextSort && nextSort !== "NEWEST") params.set("sort", nextSort);
    if (patch.page && patch.page !== "1") params.set("page", patch.page);
    cats.forEach((c) => params.append("category", c));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const toggleCategory = (id: string) => {
    const next = activeCategories.includes(id)
      ? activeCategories.filter((c) => c !== id)
      : [...activeCategories, id];
    buildParams({ categories: next, page: "1" });
  };

  const clearAll = () => {
    setMobileOpen(false);
    router.push(pathname);
  };

  const applyPrice = (min: string, max: string) => {
    buildParams({ minPrice: min, maxPrice: max, page: "1" });
  };

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-[280px] shrink-0 lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
          <FilterBody
            categories={categories}
            activeCategories={activeCategories}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onToggleCategory={toggleCategory}
            onClearAll={clearAll}
            onApplyPrice={applyPrice}
          />
        </div>
      </aside>

      {/* Mobile filters drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[300px] overflow-y-auto bg-card p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <FilterBody
              categories={categories}
              activeCategories={activeCategories}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onToggleCategory={toggleCategory}
              onClearAll={clearAll}
              onApplyPrice={applyPrice}
            />
          </div>
        </div>
      )}

      {/* Main area */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Course Catalog
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing {totalResults.toLocaleString("en-US")} result
              {totalResults === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile filter toggle */}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Filter className="size-4" />
              Filters
            </Button>

            {/* Sort select */}
            <div className="relative flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Sort by:
              </span>
              <select
                value={sort}
                onChange={(e) =>
                  buildParams({ sort: e.target.value as CatalogSort, page: "1" })
                }
                className="cursor-pointer appearance-none rounded-md border border-input bg-background py-2 pl-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                {(Object.keys(SORT_LABELS) as CatalogSort[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 size-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Search */}
        <form
          className="mb-6 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            buildParams({ search: String(form.get("search") ?? ""), page: "1" });
          }}
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="search"
              defaultValue={search}
              placeholder="Search courses..."
              className="w-full rounded-full border border-input bg-background py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>

        {children}
      </main>
    </div>
  );
}
