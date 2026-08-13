"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, BookmarkX } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { CourseCard, type CourseCardCourse } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/user/empty-state";
import { PageHeader } from "@/components/user/page-header";
import { useI18n } from "@/i18n";

interface WishlistItem {
  savedAt: string;
  course: CourseCardCourse;
}

export default function SavedPage() {
  const { t } = useI18n();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-wishlist"],
    queryFn: () => apiFetch<{ items: WishlistItem[] }>("/api/me/wishlist"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-outline-variant">
              <Skeleton className="h-[190px] w-full" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.nav.saved}
        title={t.nav.saved}
        subtitle={`${items.length} ${t.roadmap.courses}`}
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
          title="No saved courses yet"
          description="Courses you bookmark will appear here."
          action={
            <Button asChild>
              <Link href="/courses">{t.dashboard.browseCourses}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CourseCard key={item.course.id} course={item.course} />
          ))}
        </div>
      )}
    </div>
  );
}