import Link from "next/link";
import { Star, Users } from "lucide-react";
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
  category?: { id: string; name: string; slug: string } | null;
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
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative h-[180px] w-full overflow-hidden bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={course.title}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted text-3xl">
            🌿
          </div>
        )}
        {course.isFeatured && (
          <span className="absolute left-3 top-3 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
            Featured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {showCategory && course.category && (
            <span className="rounded bg-muted px-2 py-1">{course.category.name}</span>
          )}
        </div>

        <h3 className="mb-2 line-clamp-2 font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        {course.subtitle && (
          <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
            {course.subtitle}
          </p>
        )}

        <div className="mt-auto">
          <div className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {typeof course.rating === "number" ? (
              <span className="flex items-center gap-1">
                <span className="flex text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-3.5",
                        i < Math.round(course.rating ?? 0)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted text-muted",
                      )}
                    />
                  ))}
                </span>
                <span className="font-bold text-foreground">
                  {course.rating.toFixed(1)}
                </span>
                {typeof course.ratingCount === "number" &&
                  course.ratingCount > 0 && (
                    <span>({course.ratingCount} reviews)</span>
                  )}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <Users className="size-4" />
              {course.studentCount.toLocaleString("en-US")}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-base font-bold text-foreground">
              {formatPrice(price)}
            </span>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              View course
            </Badge>
          </div>
        </div>
      </div>
    </Link>
  );
}
