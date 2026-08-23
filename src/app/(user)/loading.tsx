import { Skeleton } from "@/components/ui/skeleton";

export default function UserLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-28" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-border/50 bg-card p-6 shadow-sm"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}