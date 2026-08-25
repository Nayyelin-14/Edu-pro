"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { formatPrice } from "@/lib/utils";

export function CheckoutButton({
  courseId,
  price,
  isFree,
}: {
  courseId: string;
  price: number;
  isFree: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isFree) {
        await apiFetch(`/api/courses/${courseId}/enroll`, { method: "POST" });
        router.push(`/learning/${courseId}`);
        router.refresh();
        return;
      }

      const res = await apiFetch<{
        checkoutUrl: string | null;
        alreadyEnrolled: boolean;
      }>(`/api/courses/${courseId}/checkout`, { method: "POST" });

      if (res.alreadyEnrolled) {
        router.push(`/learning/${courseId}`);
        router.refresh();
        return;
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      setError("Could not start checkout. Please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Button
        size="lg"
        className="w-full"
        onClick={() => void onClick()}
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {isFree ? "Enrolling…" : "Redirecting to Stripe…"}
          </>
        ) : (
          <>
            {isFree ? (
              <>
                <Lock className="size-4" />
                Enroll for free
              </>
            ) : (
              <>
                <CreditCard className="size-4" />
                Pay {formatPrice(price)}
              </>
            )}
          </>
        )}
      </Button>
      {error && <p className="mt-3 text-center text-sm text-rose-500">{error}</p>}
    </div>
  );
}
