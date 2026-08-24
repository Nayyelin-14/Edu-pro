import Link from "next/link";
import { BookX, ArrowLeft, Search } from "lucide-react";

export default function CourseNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-grow items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="relative mb-6 flex size-32 items-center justify-center rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <BookX className="size-14 text-primary/60" aria-hidden="true" />
          <span className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full bg-destructive text-sm font-bold text-white shadow-md">
            ?
          </span>
        </div>

        <p className="mb-1 font-mono text-sm font-medium uppercase tracking-widest text-destructive">
          Error 404
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Course not found
        </h1>
        <p className="mt-3 text-muted-foreground">
          This course doesn&apos;t exist, was removed, or hasn&apos;t been
          published yet. Browse the catalog to find something else to learn.
        </p>

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/courses"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <Search className="size-4" />
            Browse courses
          </Link>
          <Link
            href="/"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-6 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted sm:w-auto"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
