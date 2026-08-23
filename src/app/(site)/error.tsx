"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4 dark:bg-[#080b16]">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-[#111113]">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-500/10">
          <AlertTriangle className="size-7 text-red-500" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          An unexpected error occurred while loading this page.
        </p>
        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}