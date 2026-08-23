import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl border border-border/50 bg-card p-6 shadow-sm"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-[320px] rounded-xl border border-border/50 bg-card p-6 shadow-sm lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-6 h-56 w-full" />
        </div>
        <div className="h-[320px] rounded-xl border border-border/50 bg-card p-6 shadow-sm">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-6 h-5 w-full" />
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-3 h-5 w-1/2" />
        </div>
      </div>
    </div>
  );
}