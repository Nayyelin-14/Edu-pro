"use client";

import { CheckCircle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const steps = [
  { key: "understand", label: "Understanding your goal" },
  { key: "retrieve", label: "Reviewing available courses" },
  { key: "rank", label: "Building your learning path" },
  { key: "match", label: "Matching courses" },
  { key: "finalize", label: "Finalizing your roadmap" },
] as const;

export function RoadmapGenerating() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-6 text-center">
      <div className="flex items-center justify-center gap-2">
        <Sparkles className="size-8 text-primary animate-pulse" />
        <h2 className="text-2xl font-bold">{t.roadmap.generating}</h2>
      </div>

      <div className="w-full max-w-md space-y-3" role="status" aria-live="polite">
        {steps.map((step, i) => (
          <div
            key={step.key}
            className={cn(
              "flex items-center gap-4 p-3 rounded-xl border transition-all duration-300",
              i <= 0 ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border",
            )}
          >
            <div className="flex-shrink-0 size-8 rounded-full flex items-center justify-center text-sm font-medium">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
            <span className="font-medium text-on-surface">{t.roadmap.generatingSteps[step.key]}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{t.roadmap.generatingNote}</p>
    </div>
  );
}