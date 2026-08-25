import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  completeOrderFromStripe,
  markOrderRefunded,
  markOrderDisputed,
} from "@/server/services/order.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { isSuccess: false, message: "Stripe webhook is not configured" },
      { status: 503 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { isSuccess: false, message: "Missing Stripe signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return NextResponse.json(
      {
        isSuccess: false,
        message: err instanceof Error ? err.message : "Invalid signature",
      },
      { status: 400 },
    );
  }

  // Always return 2xx for events we intentionally ignore so Stripe stops retrying.
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // For async payment methods the session may complete before the charge
        // is captured. Only finalize once actually paid; otherwise wait for
        // `checkout.session.async_payment_succeeded`.
        if (session.payment_status !== "paid") break;
        await completeOrderFromStripe({
          id: session.id,
          payment_intent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        });
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await completeOrderFromStripe({
          id: session.id,
          payment_intent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        });
        break;
      }
      case "charge.refunded":
      case "charge.refund.updated": {
        const charge = event.data.object as Stripe.Charge;
        if (typeof charge.payment_intent === "string") {
          await markOrderRefunded(charge.payment_intent);
        }
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const pi = (dispute as unknown as { payment_intent?: string }).payment_intent;
        if (typeof pi === "string") await markOrderDisputed(pi);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // Only 500 for genuinely unexpected errors; Stripe retries on non-2xx.
    console.error("[stripe webhook] handler error:", err);
    return NextResponse.json({ isSuccess: false, message: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ isSuccess: true, received: true });
}
