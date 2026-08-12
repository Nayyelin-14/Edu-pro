"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

interface Enrollment {
  enrolledAt: string;
  course: {
    id: string;
    slug: string;
    title: string;
    coverImage: string | null;
    price: number;
    category: { id: string; name: string } | null;
  };
  progress: { completedLessons: number; totalLessons: number; percent: number };
}

type Tab = "all" | "in-progress" | "completed";

export default function MyCoursesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => apiFetch<{ enrollments: Enrollment[] }>("/api/me/enrollments"),
  });

  const enrollments = data?.enrollments ?? [];

  const filteredEnrollments = enrollments.filter((en) => {
    if (activeTab === "in-progress") return en.progress.percent > 0 && en.progress.percent < 100;
    if (activeTab === "completed") return en.progress.percent === 100 && en.progress.totalLessons > 0;
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-8">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col">
              <Skeleton className="aspect-video w-full" />
              <div className="p-stack-lg flex flex-col flex-grow">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-stack-md" />
                <div className="mb-stack-md">
                  <Skeleton className="h-4 w-1/4 mb-1" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
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
        <h1 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg-mobile md:font-headline-lg text-on-surface mb-stack-md">My Courses</h1>
        <p className="text-body-md text-on-surface-variant">Failed to load courses.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-stack-lg">
        <h1 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg-mobile md:font-headline-lg text-on-surface mb-stack-md">My Courses</h1>
        <div className="border-b border-outline-variant flex gap-8">
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-2 text-label-md font-label-md border-b-2 transition-colors ${
              activeTab === "all"
                ? "text-primary border-primary"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("in-progress")}
            className={`pb-2 text-label-md font-label-md border-b-2 transition-colors ${
              activeTab === "in-progress"
                ? "text-primary border-primary"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            In Progress
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`pb-2 text-label-md font-label-md border-b-2 transition-colors ${
              activeTab === "completed"
                ? "text-primary border-primary"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {filteredEnrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center text-outline mb-6">
            <span className="material-symbols-outlined text-4xl">search_off</span>
          </div>
          <h3 className="text-headline-md font-headline-md text-on-surface mb-2">
            {activeTab === "all"
              ? "No Courses Enrolled"
              : activeTab === "in-progress"
              ? "No In-Progress Courses"
              : "No Completed Courses"}
          </h3>
          <p className="text-body-md font-body-md text-on-surface-variant mb-6 max-w-md">
            {activeTab === "all"
              ? "You haven't enrolled in any courses yet. Explore our catalog to find your next learning journey."
              : activeTab === "in-progress"
              ? "You have no courses in progress. Start a course to see it here."
              : "Complete a course to see it here."}
          </p>
          {activeTab === "all" && (
            <Link
              href="/courses"
              className="px-6 py-3 bg-primary-container text-on-primary text-label-md font-label-md rounded-lg hover:opacity-90 transition-opacity"
            >
              Browse Catalog
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {filteredEnrollments.map((en) => {
            const isCompleted = en.progress.percent === 100 && en.progress.totalLessons > 0;
            const isInProgress = en.progress.percent > 0 && en.progress.percent < 100;
            return (
              <div
                key={en.course.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col shadow-[0_4px_6px_-1px_rgb(0_0_0/0.1),0_2px_4px_-2px_rgb(0_0_0/0.1)]"
              >
                <div className="relative w-full aspect-video">
                  {en.course.coverImage ? (
                    <img
                      src={en.course.coverImage}
                      alt={en.course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-[64px]">school</span>
                    </div>
                  )}
                  {isCompleted && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">check</span>
                    </div>
                  )}
                </div>
                <div className="p-stack-lg flex flex-col flex-grow">
                  <h3 className="text-title-lg font-title-lg text-on-surface mb-2 line-clamp-2">
                    {en.course.title}
                  </h3>
                  <p className="text-label-sm font-label-sm text-on-surface-variant mb-stack-md flex-grow">
                    {isCompleted
                      ? `Completed on: ${new Date(en.enrolledAt).toLocaleDateString()}`
                      : `Last accessed: ${isInProgress ? "Module " + Math.max(1, Math.ceil((en.progress.percent / 100) * 5)) : "Introduction"}`}
                  </p>
                  <div className="mb-stack-md">
                    <div className="flex justify-between text-label-sm font-label-sm mb-1 text-on-surface-variant">
                      <span>Progress</span>
                      <span>{en.progress.percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                      <div
                        className={isCompleted ? "bg-green-500 h-full rounded-full" : "bg-primary h-full rounded-full"}
                        style={{ width: `${en.progress.percent}%` }}
                      />
                    </div>
                  </div>
                  <Link
                    href={`/learning/${en.course.id}`}
                    className={`w-full py-2 text-label-md font-label-md rounded-lg transition-colors ${
                      isCompleted
                        ? "bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-surface-container"
                        : "bg-primary-container text-on-primary hover:opacity-90"
                    }`}
                  >
                    {isCompleted ? "Review Course" : "Continue Learning"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}