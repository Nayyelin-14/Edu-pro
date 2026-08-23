import { Skeleton } from "@/components/ui/skeleton";

export default function LearningLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid lg:grid-cols-[300px_1fr]">
        <div className="hidden border-r border-border p-6 lg:block">
          <Skeleton className="mb-4 h-4 w-24" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="p-6">
          <Skeleton className="mb-4 h-8 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}