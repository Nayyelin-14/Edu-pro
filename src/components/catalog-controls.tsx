"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownWideNarrow } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface CatalogControlsProps {
  currentSort: string;
}

export function CatalogControls({ currentSort }: CatalogControlsProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortOptions = [
    { value: "NEWEST", label: t.catalog.sort.newest },
    { value: "POPULAR", label: t.catalog.sort.popular },
    { value: "RATING", label: t.catalog.sort.rating },
    { value: "PRICE_ASC", label: t.catalog.sort.priceAsc },
  ];

  const buildHref = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [searchParams, pathname],
  );

  const onSortChange = (value: string) => {
    router.push(buildHref({ sort: value === "NEWEST" ? undefined : value }));
  };

  return (
    <label
      className={cn(
        "relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border bg-card px-3 py-2 transition-all",
        "border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-primary",
        "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
      )}
    >
      <ArrowDownWideNarrow className="h-4 w-4 shrink-0" />
      <select
        value={currentSort}
        onChange={(e) => onSortChange(e.target.value)}
        aria-label="Sort courses"
        className="cursor-pointer bg-transparent pr-5 text-xs font-semibold uppercase tracking-wider text-on-surface outline-none [&>option]:text-on-surface dark:[&>option]:bg-card"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}