"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BookOpen, SearchX, Search } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/user/empty-state";
import { PageHeader } from "@/components/user/page-header";
import {
  CourseProgressCard,
  type CourseProgressData,
} from "@/components/user/course-progress-card";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface Enrollment extends CourseProgressData {
  enrolledAt: string;
}

type Tab = "all" | "in-progress" | "completed";

export default function MyCoursesPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => apiFetch<{ enrollments: Enrollment[] }>("/api/me/enrollments"),
  });

  const enrollments = data?.enrollments ?? [];

  const counts = useMemo(
    () => ({
      all: enrollments.length,
      "in-progress": enrollments.filter(
        (en) => en.progress.percent > 0 && !(en.progress.percent === 100 && en.progress.totalLessons > 0),
      ).length,
      completed: enrollments.filter(
        (en) => en.progress.percent === 100 && en.progress.totalLessons > 0,
      ).length,
    }),
    [enrollments],
  );

  const filteredEnrollments = enrollments.filter((en) => {
    if (activeTab === "in-progress") {
      if (!(en.progress.percent > 0 && !(en.progress.percent === 100 && en.progress.totalLessons > 0))) {
        return false;
      }
    }
    if (activeTab === "completed") {
      if (!(en.progress.percent === 100 && en.progress.totalLessons > 0)) {
        return false;
      }
    }
    if (query.trim()) {
      return en.course.title.toLowerCase().includes(query.trim().toLowerCase());
    }
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t.catalog.all },
    { key: "in-progress", label: t.roadmap.statusInProgress },
    { key: "completed", label: t.roadmap.statusCompleted },
  ];

  const emptyCopy: Record<Tab, { title: string; description: string }> = {
    all: {
      title: "No courses enrolled",
      description:
        "You haven't enrolled in any courses yet. Explore our catalog to find your next learning journey.",
    },
    "in-progress": {
      title: "No courses in progress",
      description: "Start a course to see it here.",
    },
    completed: {
      title: "No completed courses",
      description: "Complete a course to see it here.",
    },
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-9 w-80" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-outline-variant">
              <Skeleton className="aspect-video w-full" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title={t.nav.myCourses} subtitle={t.common.error} />
        <EmptyState
          icon={<BookOpen className="size-7" />}
          title={t.common.error}
          description={t.common.error}
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.nav.myCourses}
        title={t.nav.myCourses}
        subtitle={`${enrollments.length} ${t.roadmap.courses}`}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Filter courses"
          className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-outline-variant bg-surface-container-lowest p-1"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-1.5 text-label-md font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-on-surface-variant hover:text-primary",
                )}
              >
                {tab.label}
                <span className={cn("ml-1.5 text-label-sm", active ? "opacity-80" : "opacity-60")}>
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${t.common.search}…`}
            aria-label={t.common.search}
            className="h-9 w-full rounded-full border border-input bg-surface-container-lowest pl-9 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {filteredEnrollments.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-7" />}
          title={emptyCopy[activeTab].title}
          description={query ? "No courses match your search." : emptyCopy[activeTab].description}
          action={
            activeTab === "all" && !query ? (
              <Button asChild className="gap-2">
                <Link href="/courses">
                  {t.dashboard.browseCourses}
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEnrollments.map((en) => (
            <CourseProgressCard key={en.course.id} enrollment={en} />
          ))}
        </div>
      )}
    </div>
  );
}