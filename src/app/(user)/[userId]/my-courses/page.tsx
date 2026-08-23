"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, BookOpen, SearchX, Search } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { courseGradient } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/user/empty-state";
import { PageHeader } from "@/components/user/page-header";
import { StatusBadge } from "@/components/user/status-badge";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface Enrollment {
  enrolledAt: string;
  course: {
    id: string;
    slug: string;
    title: string;
    coverImage: string | null;
    category?: { id: string; name: string } | null;
  };
  progress: { completedLessons: number; totalLessons: number; percent: number };
}

type Tab = "all" | "in-progress" | "completed";

function isCompleted(en: Enrollment) {
  return en.progress.totalLessons > 0 && en.progress.percent === 100;
}

function isInProgress(en: Enrollment) {
  return en.progress.percent > 0 && !isCompleted(en);
}

export default function MyCoursesPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => apiFetch<{ enrollments: Enrollment[] }>("/api/me/enrollments"),
  });

  const enrollments = data?.enrollments ?? [];

  const counts = {
    all: enrollments.length,
    "in-progress": enrollments.filter(isInProgress).length,
    completed: enrollments.filter(isCompleted).length,
  };

  const filteredEnrollments = enrollments.filter((en) => {
    if (activeTab === "in-progress" && !isInProgress(en)) return false;
    if (activeTab === "completed" && !isCompleted(en)) return false;
    if (query.trim()) {
      return en.course.title.toLowerCase().includes(query.trim().toLowerCase());
    }
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t.catalog.all },
    { key: "in-progress", label: t.myCourses.inProgress },
    { key: "completed", label: t.myCourses.completed },
  ];

  const emptyCopy: Record<Tab, { title: string; description: string }> = {
    all: { title: t.myCourses.emptyAll, description: t.myCourses.emptyAllDesc },
    "in-progress": {
      title: t.myCourses.emptyInProgress,
      description: t.myCourses.emptyInProgressDesc,
    },
    completed: {
      title: t.myCourses.emptyCompleted,
      description: t.myCourses.emptyCompletedDesc,
    },
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-outline-variant p-4">
              <Skeleton className="size-14 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
              <Skeleton className="h-4 w-10" />
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
        title={t.myCourses.title}
        subtitle={t.myCourses.subtitle}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Filter courses"
          className="inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-surface-container-low p-1"
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
                  "whitespace-nowrap rounded-lg px-4 py-2 text-label-md font-medium transition-all",
                  active
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                {tab.label}
                <span className={cn("ml-1.5 text-label-sm", active ? "" : "opacity-60")}>
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
            placeholder={t.myCourses.searchPlaceholder}
            aria-label={t.common.search}
            className="h-9 w-full rounded-xl bg-surface-container-low pl-9 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {filteredEnrollments.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-7" />}
          title={query ? t.myCourses.emptySearch : emptyCopy[activeTab].title}
          description={query ? undefined : emptyCopy[activeTab].description}
          action={
            activeTab === "all" && !query ? (
              <Button asChild className="gap-2">
                <Link href="/courses">{t.dashboard.browseCourses}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredEnrollments.map((en) => {
            const done = isCompleted(en);
            const inProgress = isInProgress(en);
            const label = done
              ? t.roadmap.statusCompleted
              : inProgress
                ? t.roadmap.statusInProgress
                : t.roadmap.statusNotStarted;
            const variant = done ? "success" : inProgress ? "primary" : "neutral";
            return (
              <Link
                key={en.course.id}
                href={`/learning/${en.course.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-md",
                    courseGradient(en.course.category?.name ?? en.course.id),
                  )}
                >
                  <BookOpen className="size-7 text-white" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    <p className="truncate font-semibold text-on-surface">
                      {en.course.title}
                    </p>
                    <StatusBadge
                      status={done ? "COMPLETED" : inProgress ? "IN_PROGRESS" : "NOT_STARTED"}
                      label={label}
                      variant={variant}
                      className="shrink-0"
                    />
                  </div>
                  <p className="mb-2 text-label-sm text-on-surface-variant">
                    {en.course.category?.name ?? t.roadmap.courses} ·{" "}
                    {t.myCourses.lessons(en.progress.totalLessons)}
                  </p>
                  <Progress
                    value={en.progress.percent}
                    className="h-1.5"
                    indicatorClassName="bg-gradient-to-r from-primary to-accent"
                  />
                </div>

                <div className="ml-2 shrink-0 text-right">
                  <p className="font-mono font-bold text-on-surface">
                    {en.progress.percent}%
                  </p>
                  <span className="mt-2 flex items-center justify-end gap-1 text-label-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    {t.myCourses.continue}
                    <ArrowRight className="size-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}