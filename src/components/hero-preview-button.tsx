"use client";

import { Play } from "lucide-react";
import { usePreview } from "@/components/video-preview-provider";

/**
 * The play affordance on the course hero card. Opens the free-lesson preview
 * modal. Renders nothing when the course has no free preview lesson.
 */
export function HeroPreviewButton({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId?: string;
}) {
  const { openPreview } = usePreview();
  if (!lessonId) return null;

  return (
    <button
      type="button"
      onClick={() => openPreview({ courseId, lessonId })}
      aria-label="Play course preview"
      className="absolute inset-0 flex items-center justify-center"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition-transform duration-200 group-hover/card:scale-110">
        <Play className="ml-0.5 size-6 fill-current" />
      </span>
    </button>
  );
}
