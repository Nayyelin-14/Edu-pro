"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { CourseCard, type CourseCardCourse } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface WishlistItem {
  savedAt: string;
  course: CourseCardCourse;
}

export default function SavedPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-wishlist"],
    queryFn: () => apiFetch<{ items: WishlistItem[] }>("/api/me/wishlist"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Saved courses</h1>
      <p className="mt-1 text-muted-foreground">Courses you have bookmarked.</p>

      {error && <p className="mt-4 text-sm text-destructive">Failed to load.</p>}

      {items.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No saved courses yet.</p>
          <Button asChild className="mt-4">
            <Link href="/courses">Browse courses</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CourseCard key={item.course.id} course={item.course} />
          ))}
        </div>
      )}
    </div>
  );
}
