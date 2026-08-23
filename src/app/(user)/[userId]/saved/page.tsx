"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bookmark, BookmarkX, BookOpen, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn, courseGradient, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/user/empty-state";
import { PageHeader } from "@/components/user/page-header";
import { useI18n } from "@/i18n";

interface WishlistItem {
  savedAt: string;
  course: {
    id: string;
    slug: string;
    title: string;
    price: number | null;
    coverImage?: string | null;
    category?: { id: string; name: string } | null;
    instructor?: { username: string } | null;
    studentCount?: number;
  };
}

export default function SavedPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-wishlist"],
    queryFn: () => apiFetch<{ items: WishlistItem[] }>("/api/me/wishlist"),
  });

  const items = data?.items ?? [];

  const handleRemove = async (courseId: string) => {
    setRemovingId(courseId);
    try {
      await apiFetch(`/api/courses/${courseId}/wishlist`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["my-wishlist"] });
    } catch {
      // Ignore: wishlist refreshes on next visit.
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-outline-variant">
              <Skeleton className="h-32 w-full" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.nav.saved}
        title={t.nav.saved}
        subtitle={t.saved.emptyDescription}
        actions={<Badge variant="secondary">{t.saved.count(items.length)}</Badge>}
      />

      {error ? (
        <EmptyState
          icon={<Bookmark className="size-7" />}
          title={t.common.error}
          description={t.common.error}
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BookmarkX className="size-7" />}
          title={t.saved.emptyTitle}
          description={t.saved.emptyDescription}
          action={
            <Button asChild>
              <Link href="/courses">{t.dashboard.browseCourses}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const course = item.course;
            return (
              <div
                key={course.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-lowest shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
              >
                {/* Gradient header */}
                <div
                  className={cn(
                    "relative flex h-32 items-center justify-center bg-gradient-to-br",
                    courseGradient(course.category?.name ?? course.id),
                  )}
                >
                  {course.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={course.coverImage}
                      alt={course.title}
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    <BookOpen className="h-11 w-11 text-white/80" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    aria-label={t.common.delete}
                    disabled={removingId === course.id}
                    onClick={() => handleRemove(course.id)}
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50 disabled:opacity-60"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  {course.category?.name && (
                    <p className="mb-1 text-label-sm font-semibold text-primary">
                      {course.category.name}
                    </p>
                  )}
                  <Link href={`/courses/${course.slug}`}>
                    <h3 className="line-clamp-2 text-title-md font-semibold leading-snug text-on-surface transition-colors group-hover:text-primary">
                      {course.title}
                    </h3>
                  </Link>
                  {course.instructor?.username && (
                    <p className="mb-3 mt-0.5 text-label-sm text-on-surface-variant">
                      {course.instructor.username}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between border-t border-outline-variant/70 pt-3">
                    <span className="font-mono font-bold text-on-surface">
                      {formatPrice(course.price ?? 0)}
                    </span>
                    <Link
                      href={`/courses/${course.slug}`}
                      className="rounded-lg bg-primary px-3 py-1.5 text-label-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-opacity hover:opacity-90"
                    >
                      {t.course.enroll}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}