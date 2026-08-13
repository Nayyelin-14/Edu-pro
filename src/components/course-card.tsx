import Link from "next/link";
import { ArrowUpRight, BookOpen, Star, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, formatPrice } from "@/lib/utils";

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
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export function CourseCard({
  course,
  showCategory = true,
}: {
  course: CourseCardCourse;
  showCategory?: boolean;
}) {
  const price = course.price ?? 0;
  const image = course.coverImage ?? course.thumbnail;

  const rating = typeof course.rating === "number" ? course.rating : null;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl",
        "border border-outline-variant/70 bg-surface-container-lowest",
        "shadow-sm",
        "transition-all duration-300",
        "hover:-translate-y-1.5",
        "hover:border-primary/40",
        "hover:shadow-[0_20px_45px_rgba(53,37,205,0.12)]",
      )}
    >
      {/* Card glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />

      {/* Cover image */}
      <div className="relative h-[190px] w-full overflow-hidden bg-gradient-to-br from-primary-container/20 via-secondary-container/15 to-info-container/20">
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={course.title}
              className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
            />

            {/* Image overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface/60 via-transparent to-transparent" />

            {/* Soft color wash */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
          </>
        ) : (
          <div className="flex size-full items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-lowest/80 text-primary shadow-lg">
              <BookOpen className="h-7 w-7" />
            </div>
          </div>
        )}

        {/* Featured badge */}
        {course.isFeatured && (
          <div className="absolute left-4 top-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Featured
            </span>
          </div>
        )}

        {/* Hover action */}
        <div className="absolute bottom-4 right-4 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full border border-white/20 bg-on-surface/25 text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>

      {/* Content */}
      <div className="relative flex flex-1 flex-col p-5">
        {showCategory && course.category && (
          <div className="mb-3">
            <span className="inline-flex items-center rounded-full border border-primary-container/30 bg-primary-container/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              {course.category.name}
            </span>
          </div>
        )}

        <h3 className="line-clamp-2 text-[17px] font-bold leading-6 tracking-[-0.015em] text-on-surface transition-colors duration-200 group-hover:text-primary">
          {course.title}
        </h3>

        {course.subtitle && (
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-on-surface-variant">
            {course.subtitle}
          </p>
        )}

        {/* Stats */}
        <div className="mt-auto pt-5">
          <div className="flex items-center gap-4">
            {rating !== null && (
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span className="text-sm font-bold text-on-surface">
                  {rating.toFixed(1)}
                </span>
                {typeof course.ratingCount === "number" &&
                  course.ratingCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({course.ratingCount})
                    </span>
                  )}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{course.studentCount.toLocaleString("en-US")}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-outline-variant pt-4">
            <div>
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Course price
              </p>
              <span className="text-lg font-extrabold tracking-tight text-on-surface">
                {formatPrice(price)}
              </span>
            </div>

            <Badge
              variant="outline"
              className="hidden rounded-full px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-all duration-200 group-hover:border-primary/40 group-hover:bg-primary-container/10 group-hover:text-primary sm:inline-flex"
            >
              View course
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Badge>
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-primary via-primary-fixed to-success opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </Link>
  );
}