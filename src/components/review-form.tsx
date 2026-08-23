"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

interface ExistingReview {
  id: string;
  rating: number;
  content: string | null;
}

export function ReviewForm({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [existing, setExisting] = useState<ExistingReview | null | undefined>(
    undefined,
  );

  const load = useCallback(async () => {
    if (!user) {
      setEnrolled(false);
      setExisting(null);
      return;
    }
    try {
      const [enr, review] = await Promise.all([
        apiFetch<{ enrolled: boolean }>(
          `/api/courses/${courseId}/enrollment-status`,
        ),
        apiFetch<{ review: ExistingReview | null }>(
          `/api/reviews?courseId=${courseId}`,
        ),
      ]);
      setEnrolled(enr.enrolled);
      setExisting(review.review);
      if (review.review) {
        setRating(review.review.rating);
        setContent(review.review.content ?? "");
      }
    } catch {
      setEnrolled(false);
      setExisting(null);
    }
  }, [user, courseId]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  if (!user) return null;

  const submit = async () => {
    if (rating < 1) {
      toast("Please pick a star rating", "error");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          courseId,
          rating,
          content: content.trim() || undefined,
        }),
      });
      toast("Review submitted!", "success");
      setExisting({ id: "new", rating, content: content.trim() || null });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not submit review", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111113]">
      {existing === undefined || enrolled === null ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-6" />
        </div>
      ) : existing ? (
        <div className="flex items-start gap-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              You&apos;ve reviewed this course
            </p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Your rating: {existing.rating}/5
              {existing.content ? ` — "${existing.content}"` : ""}
            </p>
          </div>
        </div>
      ) : !enrolled ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Enroll in this course to leave a review.
        </p>
      ) : (
        <div>
          <p className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
            Share your experience
          </p>

          <div className="mb-4 flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star} star${star === 1 ? "" : "s"}`}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(star)}
                className="p-1"
              >
                <Star
                  className={cn(
                    "size-7 transition-colors",
                    (hover || rating) >= star
                      ? "fill-amber-400 text-amber-400"
                      : "fill-slate-200 text-slate-200 dark:fill-slate-800 dark:text-slate-800",
                  )}
                />
              </button>
            ))}
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What did you think of the course?"
            className="mb-4 min-h-24"
            maxLength={2000}
          />

          <Button
            onClick={() => void submit()}
            disabled={submitting || rating < 1}
            className="w-full"
          >
            {submitting ? "Submitting…" : "Submit review"}
          </Button>
        </div>
      )}
    </div>
  );
}