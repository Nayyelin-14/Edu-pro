import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { bestEffort } from "@/lib/async";
import { sendPurchaseReceiptEmail } from "@/lib/email";
import { createEnrollment, enrollInTransaction } from "./enrollment.service";
import { notify } from "./notification.service";
import type { TenantContext } from "@/server/tenant-context";

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

/** Minimal payment-session shape shared by the checkout, confirm and webhook paths. */
type StripePaymentSession = {
  payment_intent?: string | null | { id: string };
};

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

/**
 * Marks an order paid and grants the enrollment in a single transaction.
 * Idempotent and concurrency-safe: concurrent confirm/webhook calls converge
 * on one PAID order and one enrollment (the unique constraints absorb the
 * duplicates). Shared by the confirm route, the Stripe webhook and checkout
 * reconciliation.
 */
async function completePaidOrder(
  order: { id: string; userId: string; courseId: string },
  session: StripePaymentSession,
): Promise<void> {
  const paymentIntentId =
    typeof session.payment_intent === "object" && session.payment_intent
      ? session.payment_intent.id
      : session.payment_intent ?? undefined;
  // The enrollment's tenant derives AUTHORITATIVELY from the course row —
  // never from request input. Orders are global; enrollments are tenant-owned.
  const course = await prisma.course.findUnique({
    where: { id: order.courseId },
    select: { tenantId: true },
  });
  if (!course) throw notFound("Course not found");
  const { created } = await prisma.$transaction(
    async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          completedAt: new Date(),
          stripePaymentIntentId: paymentIntentId,
        },
      });
      return enrollInTransaction(tx, order.userId, order.courseId, course.tenantId);
    },
    { maxWait: 20_000, timeout: 30_000 },
  );
  // Notify only for a brand-new enrollment (replayed webhooks must stay silent).
  if (created) await afterEnrollment(order.userId, order.courseId);
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
  // Tenant-scoped course lookup: cross-tenant ids resolve as "not found".
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
    // Free course — no payment needed; enroll directly.
    const { created } = await createEnrollment(userId, courseId, ctx.tenant.id);
    return { checkoutUrl: null, alreadyEnrolled: !created };
  }

  // Reuse an existing pending checkout session so refreshing the page doesn't
  // create a pile of Stripe sessions.
  const existing = await prisma.order.findFirst({
    where: { userId, courseId, status: "PENDING", stripeSessionId: { not: null } },
    select: { id: true, userId: true, courseId: true, stripeSessionId: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing?.stripeSessionId) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(existing.stripeSessionId);
    // The user may have paid in an earlier attempt whose webhook/confirm was
    // missed. Complete the purchase instead of bouncing them back to Stripe.
    if (session.payment_status === "paid") {
      await completePaidOrder(existing, session);
      return { checkoutUrl: null, alreadyEnrolled: true };
    }
    return { checkoutUrl: session.url ?? null, alreadyEnrolled: false };
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "thb",
          product_data: { name: course.title },
          unit_amount: course.price,
        },
        quantity: 1,
      },
    ],
    customer_email: (
      await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    )?.email,
    success_url: `${appUrl()}/courses/${course.slug}?payment=success`,
    cancel_url: `${appUrl()}/courses/${course.slug}`,
    metadata: { courseId: course.id, userId },
  });
  await prisma.order.create({
    data: {
      userId,
      courseId,
      amountPaid: course.price,
      currency: "THB",
      status: "PENDING",
      stripeSessionId: session.id,
    },
  });
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
  });
  if (!order || !order.stripeSessionId) {
    throw badRequest("No pending purchase found");
  }

  if (order.status === "PAID") {
    await grantEnrollment(userId, courseId, ctx.tenant.id);
    return { confirmed: true, enrolled: true, paid: true };
  }

  // Ask Stripe for the authoritative status.
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId, {
    expand: ["payment_intent"],
  });
  if (session.payment_status !== "paid") {
    return { confirmed: false, enrolled: false, paid: false };
  }
  await completePaidOrder(order, session);
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
    select: { id: true, userId: true, courseId: true, status: true },
  });
  if (!order || order.status === "PAID") return { alreadyProcessed: true };
  await completePaidOrder(order, session);
  return { alreadyProcessed: false };
}