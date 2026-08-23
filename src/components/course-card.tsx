"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpen, Clock, Star, Users } from "lucide-react";

import { useI18n } from "@/i18n";
import { cn, courseGradient, formatPrice } from "@/lib/utils";

export interface CourseCardCourse {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  coverImage?: string | null;
  thumbnail?: string | null;
  price?: number | null;
  studentCount: number;
  rating?: number | null;
  ratingCount?: number | null;
  isFeatured?: boolean | null;
  instructor?: { username: string } | null;
  moduleCount?: number;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

function gradientFor(course: CourseCardCourse): string {
  return courseGradient(course.category?.name ?? course.id);
}

function formatStudents(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  }
  return `${n}`;
}

export function CourseCard({ course }: { course: CourseCardCourse }) {
  const { t } = useI18n();
  const price = course.price ?? 0;
  const image = course.coverImage ?? course.thumbnail;
  const rating = typeof course.rating === "number" ? course.rating : null;
  const moduleCount = course.moduleCount ?? 0;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl",
        "border border-border bg-card shadow-sm",
        "transition-all duration-300",
        "hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10",
      )}
    >
      {/* Card glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />

      {/* Header */}
      <div className="relative h-40 w-full overflow-hidden">
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={course.title}
              className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </>
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(course)}`}
          >
            <BookOpen className="h-11 w-11 text-white/80" />
          </div>
        )}

        {/* Featured badge */}
        {course.isFeatured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t.course.featured}
          </span>
        )}

        {/* Hover action */}
        <div className="absolute bottom-3 right-3 flex h-8 w-8 translate-y-2 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>

      {/* Content */}
      <div className="relative flex flex-1 flex-col p-4">
        {course.category && (
          <p className="mb-1 text-xs font-semibold text-primary">
            {course.category.name}
          </p>
        )}

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors duration-200 group-hover:text-primary">
          {course.title}
        </h3>

        {course.instructor?.username ? (
          <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
            {course.instructor.username}
          </p>
        ) : (
          course.subtitle && (
            <p className="mb-2 mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {course.subtitle}
            </p>
          )
        )}

        {/* Rating */}
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={cn(
                "h-3 w-3",
                rating !== null && i <= Math.floor(rating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30",
              )}
            />
          ))}
          <span className="ml-1 font-mono text-xs text-muted-foreground">
            {rating !== null ? rating.toFixed(1) : "—"}
          </span>
          {typeof course.ratingCount === "number" && course.ratingCount > 0 && (
            <span className="ml-1 font-mono text-xs text-muted-foreground">
              ({course.ratingCount})
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="mt-2.5 flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {formatStudents(course.studentCount)}
          </span>
          {moduleCount > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t.course.modulesCount(moduleCount)}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-bold text-foreground">
            {formatPrice(price)}
          </span>

          <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-opacity group-hover:opacity-90">
            {t.course.viewCourse}
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-primary via-primary-fixed to-success opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </Link>
  );
}