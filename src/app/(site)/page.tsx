import Link from "next/link";
import { getDictionary } from "@/i18n/dictionaries";
import { CourseCard, type CourseCardCourse } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { listPublishedCourses, listCategories } from "@/server/services/course.service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = getDictionary("en");
  const [featured, categories] = await Promise.all([
    listPublishedCourses({ sort: "POPULAR", page: 1, pageSize: 6 }),
    listCategories(),
  ]);

  return (
    <div>
      <section className="border-b bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            {t.home.heroTitle}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            {t.home.heroSubtitle}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/courses">{t.home.exploreCourses}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/about">{t.home.learnMore}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t.home.featured}</h2>
            <p className="text-muted-foreground">{t.home.featuredSubtitle}</p>
          </div>
          <Button asChild variant="ghost">
            <Link href="/courses">{t.common.viewAll}</Link>
          </Button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.items.map((course) => (
            <CourseCard key={course.id} course={course as unknown as CourseCardCourse} />
          ))}
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="mb-6 text-2xl font-bold">{t.catalog.category}</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/courses?category=${c.id}`}
                className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
