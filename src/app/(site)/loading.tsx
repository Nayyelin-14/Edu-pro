import { Skeleton } from "@/components/ui/skeleton";

export default function SiteLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080b16]">
      <div className="h-56 bg-gradient-to-b from-violet-100 via-indigo-50 to-slate-50 dark:from-[#16102c] dark:via-[#0d1020] dark:to-[#080b16]" />
      <div className="mx-auto max-w-[1280px] px-4 py-10 md:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0b1326]/70"
            >
              <Skeleton className="h-48 w-full rounded-none bg-slate-100 dark:bg-white/5" />
              <div className="space-y-4 p-5">
                <Skeleton className="h-4 w-1/3 bg-slate-100 dark:bg-white/5" />
                <Skeleton className="h-6 w-3/4 bg-slate-100 dark:bg-white/5" />
                <Skeleton className="h-4 w-full bg-slate-100 dark:bg-white/5" />
                <div className="border-t border-slate-100 pt-4 dark:border-white/10">
                  <Skeleton className="h-4 w-1/2 bg-slate-100 dark:bg-white/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}