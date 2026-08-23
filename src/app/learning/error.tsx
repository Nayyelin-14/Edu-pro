"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LearningError({
  error,
  reset,
}: {
  error: Error & { digest?: string; statusCode?: number };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Learning page error:", error);
  }, [error]);

  const unauthorized = error.statusCode === 401;

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="size-7 text-destructive" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-foreground">
          {unauthorized ? "Your session has expired" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {unauthorized
            ? "Please sign in again to continue your lesson. Your progress is saved — you'll resume right where you left off."
            : "An unexpected error occurred while loading your lesson."}
        </p>
        {unauthorized ? (
          <Button asChild className="mt-6 gap-2">
            <Link href="/login">
              <LogIn className="size-4" />
              Sign in
            </Link>
          </Button>
        ) : (
          <Button onClick={reset} className="mt-6">
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}