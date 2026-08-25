"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

type Status = "idle" | "confirming" | "done" | "error";

const AUTO_CLOSE_MS = 3000;

/**
 * Handles the return trip from Stripe (`?payment=success`). Shows a clear,
 * full-screen "confirming" state (the Stripe confirm call can take a few
 * seconds) and only clears the URL after enrolling, so the user always gets
 * explicit feedback instead of a silently-loading page.
 */
export function CheckoutReturnHandler({
  courseId,
  slug,
}: {
  courseId: string;
  slug: string;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [countdown, setCountdown] = useState(3);
  const ran = useRef(false);

  useEffect(() => {
    if (params.get("payment") !== "success") return;
    if (ran.current) return; // guard against double-invoke (e.g. React StrictMode)
    ran.current = true;
    setStatus("confirming");

    (async () => {
      try {
        await apiFetch(`/api/courses/${courseId}/checkout/confirm`, {
          method: "POST",
        });
        setCountdown(3);
        setStatus("done");
        toast("Payment complete — you're enrolled!", "success");
      } catch {
        setStatus("error");
        toast("We couldn't confirm your payment. Please contact support.", "error");
      } finally {
        // Strip the query param so a refresh doesn't re-trigger confirmation.
        router.replace(`/courses/${slug}`);
        router.refresh();
      }
    })();
  }, [params, courseId, slug, router, toast]);

  // Auto-close the success modal after a short delay with a visible countdown.
  useEffect(() => {
    if (status !== "done") return;
    const interval = setInterval(
      () => setCountdown((c) => Math.max(0, c - 1)),
      1000,
    );
    const timeout = setTimeout(() => {
      setStatus("idle");
      router.push(`/learning/${courseId}`);
    }, AUTO_CLOSE_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, courseId, router]);

  if (status === "idle") return null;

  const goToCourse = () => {
    setStatus("idle");
    router.push(`/learning/${courseId}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative mx-4 flex w-full max-w-sm flex-col items-center gap-5 overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-2xl">
        {/* Top accent line */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-primary to-accent" />

        {status === "confirming" && (
          <>
            <span className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="size-9 animate-spin text-primary" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Confirming your payment…
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hang tight while we finalize your enrollment.
              </p>
            </div>
          </>
        )}

        {status === "done" && (
          <>
            <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 ring-4 ring-emerald-500/15">
              <CheckCircle2 className="size-9 text-emerald-500" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-foreground">You&apos;re enrolled!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your payment was successful. Let&apos;s start learning.
              </p>
            </div>

            {/* Progress bar + countdown */}
            <div className="w-full">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${(countdown / 3) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                This window will close in {countdown}s
              </p>
            </div>

            <button
              type="button"
              onClick={goToCourse}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Go to course
              <ArrowRight className="size-4" />
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <span className="flex size-16 items-center justify-center rounded-full bg-rose-500/10 ring-4 ring-rose-500/15">
              <XCircle className="size-9 text-rose-500" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Something went wrong
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We couldn&apos;t confirm your payment automatically. Please contact
                support if this persists.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
