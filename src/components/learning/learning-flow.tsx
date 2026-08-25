"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PartyPopper, ArrowRight, Flag } from "lucide-react";

export type FlowItemType = "lesson" | "quiz";

interface NextItemPayload {
  id: string;
  type: FlowItemType;
  title: string;
  moduleId: string;
}

interface FlowContextValue {
  notifyCompleted: (item: { id: string; type: FlowItemType }) => void;
  /** Live course progress — updated the instant a completion succeeds, so the
   *  UI never depends on server-refresh latency to reflect changes. */
  progress: { completedItems: number; totalItems: number; percent: number };
}

const FlowContext = createContext<FlowContextValue | null>(null);

export function useLearningFlow(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) return { notifyCompleted: () => {}, progress: { completedItems: 0, totalItems: 0, percent: 0 } };
  return ctx;
}

const REDIRECT_SECONDS = 5;

interface OverlayState {
  kind: "next" | "done" | "end";
  nextTitle?: string;
  nextUrl?: string;
  seconds: number;
  /** For `kind: "end"` — link to the first item still unfinished. */
  resumeTitle?: string;
  resumeUrl?: string;
  /** For `kind: "end"` — how many items remain to complete the course. */
  remaining?: number;
}

export function LearningFlow({
  courseId,
  courseSlug,
  myCoursesHref,
  initialProgress,
  children,
}: {
  courseId: string;
  courseSlug: string;
  myCoursesHref: string;
  initialProgress: { completedItems: number; totalItems: number; percent: number };
  children: ReactNode;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(initialProgress);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  // Guards against duplicate redirects triggered by repeated completion events
  // (e.g. a video firing "ended" twice, or two tabs).
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    activeRef.current = false;
    setOverlay(null);
  }, [clearTimer]);

  // Clean up the running timer if the component unmounts (e.g. navigating away
  // to a different course) so no stray timeout fires afterwards.
  useEffect(() => clearTimer, [clearTimer]);

  const notifyCompleted = useCallback(
    async (item: { id: string; type: FlowItemType }) => {
      if (activeRef.current) return;
      activeRef.current = true;

      let result: unknown = null;
      try {
        const res = await fetch(
          `/api/learning/${courseId}/next?itemId=${encodeURIComponent(item.id)}&type=${item.type}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          activeRef.current = false;
          return;
        }
        result = await res.json();
      } catch {
        activeRef.current = false;
        return;
      }

      const envelope = result as {
        isSuccess: boolean;
        data: {
          hasNext: boolean;
          courseCompleted: boolean;
          nextItem: NextItemPayload | null;
          firstIncomplete: NextItemPayload | null;
          progress: { completedItems: number; totalItems: number; percent: number };
        };
      };
      const payload = envelope.data;
      // Reflect the new progress immediately (don't wait for router.refresh()).
      if (payload.progress) setProgress(payload.progress);

      if (payload.courseCompleted) {
        setOverlay({ kind: "done", seconds: 0 });
        return;
      }

      if (payload.hasNext && payload.nextItem) {
        const next = payload.nextItem;
        const url = `/learning/${courseId}?${next.type}=${next.id}`;
        setOverlay({ kind: "next", nextTitle: next.title, nextUrl: url, seconds: REDIRECT_SECONDS });
        let remaining = REDIRECT_SECONDS;
        timerRef.current = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearTimer();
            setOverlay(null);
            activeRef.current = false;
            router.push(url);
            return;
          }
          setOverlay((o) => (o ? { ...o, seconds: remaining } : o));
        }, 1000);
        return;
      }

      // Last item in sequence finished but the course is still incomplete:
      // show the end-of-content screen with a link to the next unfinished item
      // instead of auto-redirecting to an unrelated earlier lesson.
      if (payload.firstIncomplete) {
        const fi = payload.firstIncomplete;
        const resumeUrl = `/learning/${courseId}?${fi.type}=${fi.id}`;
        const remaining = Math.max(
          0,
          payload.progress.totalItems - payload.progress.completedItems,
        );
        setOverlay({ kind: "end", resumeTitle: fi.title, resumeUrl, remaining, seconds: 0 });
        return;
      }

      activeRef.current = false;
    },
    [courseId, router, clearTimer],
  );

  return (
    <FlowContext.Provider value={{ notifyCompleted, progress }}>
      {children}

      {overlay?.kind === "next" && (
        <div className="fixed inset-x-0 top-20 z-50 flex justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-card shadow-2xl p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Next up · continuing in {overlay.seconds}s
              </p>
              <p className="text-sm font-semibold text-foreground truncate">
                {overlay.nextTitle}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={dismiss}>
              Stay here
            </Button>
          </div>
        </div>
      )}

      {overlay?.kind === "done" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <PartyPopper className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Course completed!
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Congratulations — you&apos;ve finished every lesson and quiz in this
              course.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href={`/courses/${courseSlug}`}>
                  Back to course <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={myCoursesHref}>My courses</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {overlay?.kind === "end" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <Flag className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              End of course content
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;ve finished the last item in sequence.{" "}
              {overlay.remaining === 1
                ? "1 item still needs"
                : `${overlay.remaining} items still need`}{" "}
              completing to earn your certificate.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href={overlay.resumeUrl ?? "#"}>
                  Jump to next unfinished <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" onClick={dismiss}>
                Stay here
              </Button>
            </div>
          </div>
        </div>
      )}
    </FlowContext.Provider>
  );
}

/**
 * Renders the live course progress. Driven by the LearningFlow context (which
 * is updated the instant a completion succeeds), so it never depends on
 * server-refresh latency. Use `variant="chip"` inside the header and
 * `variant="bar"` as the always-visible progress strip.
 */
export function LearningProgress({
  variant,
}: {
  variant: "chip" | "bar";
}) {
  const { progress } = useLearningFlow();
  if (variant === "chip") {
    return (
      <span className="hidden sm:flex items-center gap-2 pl-1 text-xs font-mono">
        <span className="text-muted-foreground">
          {progress.completedItems}/{progress.totalItems}
        </span>
        <span className="font-semibold text-foreground">
          {progress.percent}%
        </span>
      </span>
    );
  }
  return (
    <div className="h-1.5 w-full flex-none bg-muted">
      <div
        className="h-full bg-primary transition-[width] duration-500 ease-out"
        style={{ width: `${progress.percent}%` }}
      />
    </div>
  );
}
