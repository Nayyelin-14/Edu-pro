"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared banner for surfacing an unsaved roadmap draft. Used on both the
 * roadmaps list (discard / continue reviewing) and the detail page (save /
 * discard) so the two never drift apart visually.
 */
export function DraftBanner({
  title,
  description,
  subtitle,
  children,
  className,
}: {
  title: string;
  description?: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-primary/20 bg-surface-container-low p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-title-md font-semibold text-on-surface">{title}</p>
          {description && (
            <p className="text-label-sm text-on-surface-variant">{description}</p>
          )}
          {subtitle && (
            <p className="mt-1 line-clamp-1 text-label-sm font-medium text-on-surface">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children && <div className="flex shrink-0 gap-2">{children}</div>}
    </div>
  );
}