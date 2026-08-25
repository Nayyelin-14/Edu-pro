import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { bestEffort } from "@/lib/async";
import { sendPurchaseReceiptEmail } from "@/lib/email";
import { createEnrollment } from "./enrollment.service";
import { notify } from "./notification.service";
import type { TenantContext } from "@/server/tenant-context";

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

/** Rejects if `promise` does not settle within `ms`, so a slow upstream
 *  (e.g. Stripe) can never hang an interactive request. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

type Orderish = {
  id: string;
  userId: string;
  courseId: string;
  amountPaid: number;
  currency: string;
  stripeSessionId: string | null;
};

/**
 * Verifies the Stripe session is actually paid for the expected amount/currency
 * and transitions the order PENDING -> PAID exactly once (optimistic lock).
 * Idempotent: concurrent callers converge on one PAID order + one enrollment.
 */
async function completePaidOrder(order: Orderish): Promise<{ created: boolean }> {
  if (!order.stripeSessionId) throw new Error(`Order ${order.id} has no Stripe session`);

  const stripe = getStripe();
  const retrieved = await stripe.checkout.sessions.retrieve(order.stripeSessionId, {
    expand: ["payment_intent"],
  });

  // Never fulfil an unpaid session (covers async payment methods).
  if (retrieved.payment_status !== "paid") {
    throw new Error(
      `Refusing to complete order ${order.id}: payment_status=${retrieved.payment_status}`,
    );
  }

  // Defense-in-depth: confirm the amount/currency Stripe actually captured
  // matches what we recorded. Catches misconfig / tampering.
  const pi = retrieved.payment_intent as
    | { id?: string; amount?: number; currency?: string }
    | string
    | null;
  const piObj =
    pi && typeof pi === "object"
      ? pi
      : null;
  if (piObj) {
    if (typeof piObj.amount === "number" && piObj.amount !== order.amountPaid * 100) {
      throw new Error(
        `Order ${order.id} amount mismatch: PaymentIntent ${piObj.amount} vs expected ${order.amountPaid * 100}`,
      );
    }
    if (
      piObj.currency &&
      piObj.currency.toLowerCase() !== order.currency.toLowerCase()
    ) {
      throw new Error(
        `Order ${order.id} currency mismatch: ${piObj.currency} vs ${order.currency}`,
      );
    }
  }

  const course = await prisma.course.findUnique({
    where: { id: order.courseId },
    select: { tenantId: true },
  });
  if (!course) throw notFound("Course not found");

  // Optimistic lock: only the first writer wins; the rest short-circuit.
  const locked = await prisma.order.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: {
      status: "PAID",
      completedAt: new Date(),
      stripePaymentIntentId:
        typeof pi === "string" ? pi : piObj?.id ?? order.stripeSessionId,
    },
  });
  if (locked.count === 0) return { created: false };

  const { created } = await createEnrollment(order.userId, order.courseId, course.tenantId);
  if (created) await afterEnrollment(order.userId, order.courseId);
  return { created };
}

/**
 * Starts a Stripe Checkout session for a paid course. Free courses enroll
 * immediately (no payment step). Returns the URL the client should redirect to.
 */
export async function startCheckout(
  ctx: TenantContext,
  courseId: string,
): Promise<{ checkoutUrl: string | null; alreadyEnrolled: boolean }> {
  const userId = ctx.user.id;
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId: ctx.tenant.id },
    select: { id: true, slug: true, title: true, price: true, isPublished: true },
  });
  if (!course || !course.isPublished) throw notFound("Course not found");

  const enrolled = await prisma.enrollment.findFirst({
    where: { userId, courseId, tenantId: ctx.tenant.id },
    select: { id: true },
  });
  if (enrolled) return { checkoutUrl: null, alreadyEnrolled: true };

  if (course.price <= 0) {
    const { created } = await createEnrollment(userId, courseId, ctx.tenant.id);
    return { checkoutUrl: null, alreadyEnrolled: !created };
  }

  // Reuse an existing in-flight checkout session so a page refresh / retry does
  // not pile up Stripe sessions or PENDING orders.
  const existing = await prisma.order.findFirst({
    where: { userId, courseId, status: "PENDING", stripeSessionId: { not: null } },
    select: {
      id: true,
      userId: true,
      courseId: true,
      stripeSessionId: true,
      amountPaid: true,
      currency: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing?.stripeSessionId) {
    const session = await getStripe().checkout.sessions.retrieve(existing.stripeSessionId);
    // A missed webhook may have already paid this session — finish it here.
    if (session.payment_status === "paid" || session.status === "complete") {
      await completePaidOrder(existing);
      return { checkoutUrl: null, alreadyEnrolled: true };
    }
    // A live, open session can be resumed directly.
    if (session.status === "open") {
      return { checkoutUrl: session.url ?? null, alreadyEnrolled: false };
    }
    // Expired/unusable -> fall through and create a fresh session.
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "thb",
            product_data: { name: course.title },
            unit_amount: course.price * 100,
          },
          quantity: 1,
        },
      ],
      customer_email: user?.email,
      success_url: `${appUrl()}/courses/${course.slug}?payment=success`,
      cancel_url: `${appUrl()}/courses/${course.slug}`,
      metadata: { courseId: course.id, userId },
    },
    // Idempotency: retries of the same intent reuse the original session.
    { idempotencyKey: `co_${userId}_${courseId}` },
  );

  const order = await prisma.order
    .create({
      data: {
        userId,
        courseId,
        amountPaid: course.price,
        currency: "THB",
        status: "PENDING",
        stripeSessionId: session.id,
      },
    })
    .catch(async (err) => {
      // A concurrent insert may have won the (userId, courseId, PENDING) unique.
      if (err?.code === "P2002") {
        const won = await prisma.order.findFirst({
          where: { userId, courseId, status: "PENDING", stripeSessionId: { not: null } },
          select: {
            id: true,
            userId: true,
            courseId: true,
            stripeSessionId: true,
            amountPaid: true,
            currency: true,
          },
          orderBy: { createdAt: "desc" },
        });
        if (won?.stripeSessionId) {
          const s = await getStripe().checkout.sessions.retrieve(won.stripeSessionId);
          if (s.status === "open") return null; // caller treats null as "reuse existing"
        }
      }
      throw err;
    });

  // Another request created the order first; reuse its session.
  if (!order) {
    const won = await prisma.order.findFirst({
      where: { userId, courseId, status: "PENDING", stripeSessionId: { not: null } },
      select: { stripeSessionId: true },
      orderBy: { createdAt: "desc" },
    });
    if (won?.stripeSessionId) {
      const s = await getStripe().checkout.sessions.retrieve(won.stripeSessionId);
      return { checkoutUrl: s.url ?? null, alreadyEnrolled: false };
    }
  }

  return { checkoutUrl: session.url ?? null, alreadyEnrolled: false };
}

/**
 * Confirms a pending order after the user returns from Stripe (or when the
 * webhook already completed it). Enrolls the user when the payment is paid.
 */
export async function confirmOrder(
  ctx: TenantContext,
  courseId: string,
): Promise<{ confirmed: boolean; enrolled: boolean; paid: boolean }> {
  const userId = ctx.user.id;
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId: ctx.tenant.id },
    select: { id: true, price: true, isPublished: true },
  });
  if (!course || !course.isPublished) throw notFound("Course not found");

  if (course.price <= 0) {
    await grantEnrollment(userId, courseId, ctx.tenant.id);
    return { confirmed: true, enrolled: true, paid: true };
  }

  const order = await prisma.order.findFirst({
    where: { userId, courseId, status: { in: ["PENDING", "PAID"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      courseId: true,
      status: true,
      amountPaid: true,
      currency: true,
      stripeSessionId: true,
    },
  });
  if (!order || !order.stripeSessionId) {
    throw badRequest("No pending purchase found");
  }

  if (order.status === "PAID") {
    await grantEnrollment(userId, courseId, ctx.tenant.id);
    return { confirmed: true, enrolled: true, paid: true };
  }

  // Ask Stripe for the authoritative status (bounded so a slow upstream
  // can never hang this interactive request).
  const session = await withTimeout(
    getStripe().checkout.sessions.retrieve(order.stripeSessionId, {
      expand: ["payment_intent"],
    }),
    10_000,
    "stripe.session.retrieve",
  );
  if (session.payment_status !== "paid") {
    return { confirmed: false, enrolled: false, paid: false };
  }
  await completePaidOrder(order);
  return { confirmed: true, enrolled: true, paid: true };
}

/** Idempotent enrollment grant used once a course is confirmed paid.
 *  `tenantId` MUST be derived server-side (TenantContext or the course row). */
export async function grantEnrollment(userId: string, courseId: string, tenantId: string) {
  const { created } = await createEnrollment(userId, courseId, tenantId);
  if (created) await afterEnrollment(userId, courseId);
  return { alreadyEnrolled: !created };
}

/**
 * Best-effort post-enrollment side effects. Only called when the enrollment
 * was actually created (never on replays), and failures are suppressed.
 */
async function afterEnrollment(userId: string, courseId: string): Promise<void> {
  const [course, user] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true, slug: true, price: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  if (!course || !user) return;
  await bestEffort(
    "notification.course_enrolled",
    notify({
      userId,
      type: "COURSE_ENROLLED",
      title: `Enrolled in "${course.title}"`,
      body:
        course.price > 0
          ? "Your purchase is confirmed. Happy learning!"
          : "Your enrollment is confirmed. Happy learning!",
      link: `/learning/${courseId}`,
      courseId,
    }),
  );
  if (course.price > 0) {
    await bestEffort(
      "email.receipt",
      sendPurchaseReceiptEmail(
        user.email,
        course.title,
        course.price,
        `${appUrl()}/learning/${courseId}`,
      ),
    );
  }
}

/** Webhook entry point for a completed Stripe Checkout session. */
export async function completeOrderFromStripe(session: {
  id: string;
  payment_intent?: string | null;
}) {
  const order = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
    select: {
      id: true,
      userId: true,
      courseId: true,
      status: true,
      amountPaid: true,
      currency: true,
      stripeSessionId: true,
    },
  });
  if (!order) return { alreadyProcessed: false, reason: "no_order" };
  // Terminal states: do not re-process refunds/disputes or already-paid orders.
  if (order.status === "PAID" || order.status === "REFUNDED" || order.status === "DISPUTED") {
    return { alreadyProcessed: true };
  }
  await completePaidOrder({
    id: order.id,
    userId: order.userId,
    courseId: order.courseId,
    amountPaid: order.amountPaid,
    currency: order.currency,
    stripeSessionId: order.stripeSessionId!,
  });
  return { alreadyProcessed: false };
}

/** Marks an order refunded (via Stripe `charge.refunded`). */
export async function markOrderRefunded(paymentIntentId: string) {
  const order = await prisma.order.findFirst({ where: { stripePaymentIntentId: paymentIntentId } });
  if (!order) return;
  if (order.status === "REFUNDED") return;
  await prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
  await bestEffort(
    "notification.refunded",
    notify({
      userId: order.userId,
      type: "COURSE_ENROLLED",
      title: "Your purchase was refunded",
      body: "A refund has been issued for one of your courses.",
      link: `/learning/${order.courseId}`,
      courseId: order.courseId,
    }),
  );
}

/** Marks an order as disputed (via Stripe `charge.dispute.created`). */
export async function markOrderDisputed(paymentIntentId: string) {
  const order = await prisma.order.findFirst({ where: { stripePaymentIntentId: paymentIntentId } });
  if (!order) return;
  if (order.status === "DISPUTED") return;
  await prisma.order.update({ where: { id: order.id }, data: { status: "DISPUTED" } });
}

/**
 * Reconciliation safety net: catches PENDING orders whose Stripe session is
 * actually paid (webhook missed + user never returned) and expires dead ones.
 * Wire this to a cron (e.g. every 10 minutes).
 */
export async function reconcilePendingOrders(): Promise<{ completed: number; expired: number }> {
  const pending = await prisma.order.findMany({
    where: { status: "PENDING", stripeSessionId: { not: null } },
    select: {
      id: true,
      userId: true,
      courseId: true,
      amountPaid: true,
      currency: true,
      stripeSessionId: true,
    },
  });
  let completed = 0;
  let expired = 0;
  for (const o of pending) {
    try {
      const s = await getStripe().checkout.sessions.retrieve(o.stripeSessionId!);
      if (s.payment_status === "paid" || s.status === "complete") {
        await completePaidOrder(o);
        completed += 1;
      } else if (s.status === "expired") {
        await prisma.order.update({ where: { id: o.id }, data: { status: "EXPIRED" } });
        expired += 1;
      }
    } catch (e) {
      console.error(`[reconcile] order ${o.id} failed:`, e);
    }
  }
  return { completed, expired };
}

/**
 * Returns true when the user already has a paid (or free) enrollment.
 * `tenantId` MUST come from a trusted TenantContext or the resource itself.
 */
export async function hasAccess(userId: string, courseId: string, tenantId: string) {
  const enrolled = await prisma.enrollment.findFirst({
    where: { userId, courseId, tenantId },
    select: { id: true },
  });
  if (enrolled) return true;
  const paid = await prisma.order.findFirst({
    where: { userId, courseId, status: "PAID" },
    select: { id: true },
  });
  return paid !== null;
}

export async function getPaidOrder(userId: string, courseId: string) {
  return prisma.order.findFirst({
    where: { userId, courseId, status: "PAID" },
    orderBy: { createdAt: "desc" },
  });
}
