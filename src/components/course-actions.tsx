"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  Clock,
  GraduationCap,
  Layers,
  Play,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatDuration, formatPrice } from "@/lib/utils";

interface MyEnrollment {
  course: { id: string };
  progress: { completedLessons: number; totalLessons: number; percent: number };
}

export function CourseActions({
  courseId,
  slug,
  isFree,
  price,
  coverImage,
  studentCount,
  totalLessons,
  totalDurationSeconds,
  rating,
  ratingCount,
  initialSignedIn = false,
  initialEnrolled = false,
  initialProgress = null,
  initialSaved = false,
}: {
  courseId: string;
  slug: string;
  isFree: boolean;
  price: number;
  coverImage: string | null;
  studentCount: number;
  totalLessons: number;
  totalDurationSeconds: number;
  rating: number;
  ratingCount: number;
  initialSignedIn?: boolean;
  initialEnrolled?: boolean;
  initialProgress?: number | null;
  initialSaved?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [saved, setSaved] = useState(initialSaved);
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(initialProgress);

  // The server already knows the auth state (initialSignedIn), so we use that
  // while useAuth() is still resolving to avoid flashing "Sign in to enroll".
  const signedIn = loading ? initialSignedIn : Boolean(user);

  // Returning from a successful Stripe checkout: confirm the payment and
  // enroll (the webhook may not have arrived yet).
  useEffect(() => {
    if (!user || searchParams.get("payment") !== "success") return;
    let cancelled = false;
    void (async () => {
      try {
        await apiFetch(`/api/courses/${courseId}/checkout/confirm`, {
          method: "POST",
        });
        if (!cancelled) {
          setEnrolled(true);
          toast("Enrolled!", "success");
          router.replace(`/courses/${slug}`);
          router.refresh();
        }
      } catch (err) {
        if (!cancelled) {
          toast(err instanceof Error ? err.message : "Payment not confirmed", "error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, courseId, slug, searchParams, router, toast]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const [st, wl, en] = await Promise.all([
          apiFetch<{ enrolled: boolean }>(
            `/api/courses/${courseId}/enrollment-status`,
          ),
          apiFetch<{ saved: boolean }>(`/api/courses/${courseId}/wishlist`),
          apiFetch<{ enrollments: MyEnrollment[] }>("/api/me/enrollments"),
        ]);
        if (cancelled) return;
        setEnrolled(st.enrolled);
        setSaved(wl.saved);
        if (st.enrolled) {
          const match = en.enrollments.find((e) => e.course.id === courseId);
          setProgress(match?.progress.percent ?? null);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, courseId]);

  const enroll = async () => {
    setBusy(true);
    try {
      if (isFree) {
        await apiFetch(`/api/courses/${courseId}/enroll`, { method: "POST" });
        setEnrolled(true);
        toast("Enrolled!", "success");
        router.refresh();
        router.push(`/learning/${courseId}`);
        return;
      }
      // Paid course: create/resume the Stripe Checkout session and redirect.
      const res = await apiFetch<{ checkoutUrl: string | null; alreadyEnrolled: boolean }>(
        `/api/courses/${courseId}/checkout`,
        { method: "POST" },
      );
      if (res.alreadyEnrolled) {
        setEnrolled(true);
        router.refresh();
        router.push(`/learning/${courseId}`);
        return;
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleSave = async () => {
    try {
      await apiFetch(`/api/courses/${courseId}/wishlist`, {
        method: saved ? "DELETE" : "POST",
      });
      setSaved((v) => !v);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full bg-muted">
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt={slug}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-4xl">
            🌿
          </div>
        )}
        {enrolled && (
          <button
            type="button"
            onClick={() => router.push(`/learning/${courseId}`)}
            className="group absolute inset-0 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/40"
            aria-label="Continue learning"
          >
            <Play className="size-12 text-white opacity-90 transition-opacity group-hover:opacity-100" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        {/* Price */}
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {formatPrice(price)}
          </span>
        </div>

        {/* Primary CTA */}
        {!signedIn ? (
          <Button asChild size="lg" className="w-full">
            <Link href={`/login?next=/courses/${slug}`}>Sign in to enroll</Link>
          </Button>
        ) : enrolled ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <GraduationCap className="size-4" />
              You are enrolled
            </div>
            {progress !== null && (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
                <span className="text-right text-xs text-muted-foreground">
                  {progress}% Complete
                </span>
              </>
            )}
            <Button asChild size="lg" className="w-full">
              <Link href={`/learning/${courseId}`}>
                <Play />
                Continue Learning
              </Link>
            </Button>
          </div>
        ) : (
          <Button size="lg" className="w-full" onClick={() => void enroll()} disabled={busy}>
            {busy
              ? isFree
                ? "Enrolling…"
                : "Starting checkout…"
              : isFree
                ? "Enroll now"
                : `Buy now · ${formatPrice(price)}`}
          </Button>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => void toggleSave()}
        >
          {saved ? <BookmarkCheck /> : <Bookmark />}
          {saved ? "Saved" : "Save course"}
        </Button>

        {/* Meta */}
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <MetaRow
            icon={<Clock className="size-[18px]" />}
            label="Duration"
            value={totalDurationSeconds > 0 ? formatDuration(totalDurationSeconds) : "—"}
          />
          <MetaRow
            icon={<Layers className="size-[18px]" />}
            label="Lessons"
            value={String(totalLessons)}
          />
          <MetaRow
            icon={<Users className="size-[18px]" />}
            label="Enrolled"
            value={studentCount.toLocaleString("en-US")}
          />
          <MetaRow
            icon={<Star className="size-[18px]" />}
            label="Rating"
            value={
              ratingCount > 0
                ? `${rating.toFixed(1)} (${ratingCount} reviews)`
                : "No reviews yet"
            }
          />
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
