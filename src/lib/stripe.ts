import Stripe from "stripe";
import { serviceUnavailable } from "./errors";

let client: Stripe | null = null;

/** Lazily-created Stripe client. Throws 503 when not configured so the app
 * fails closed in production (no silent free access to paid courses). */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw serviceUnavailable("Payments are not configured");
  if (!client) {
    client = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });
  }
  return client;
}