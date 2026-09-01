// MODELZON — Stripe webhook endpoint.
//
// ⚠️ IMPORTANT — verify against your installed @tanstack/react-start docs:
// this project pins "@tanstack/react-start": "^1.168.26". The API-route
// export below (`ServerRoute` from `createServerFileRoute`) is the current
// TanStack Start convention for a raw HTTP endpoint (as opposed to the
// createServerFn RPC pattern used everywhere else in this repo, which
// can't be called directly by an external service like Stripe). This file
// could not be built/tested in this sandbox (no network access), so run
// `npm run dev` once after pulling this in and confirm POST
// /api/stripe-webhook actually resolves before relying on it in production.
//
// WHY THIS EXISTS: without a webhook, a subscription cancelled from
// Stripe's own Customer Portal (openBillingPortal in
// subscription.functions.ts) never told our database — the person kept
// their paid tier forever until they happened to re-checkout. This closes
// that gap, and also makes checkout.session.completed a second, more
// reliable path to mark orders paid (confirmCheckoutSession on the
// redirect is still the primary path; this is the safety net for people
// who close the tab before the redirect finishes).
//
// SETUP: in the Stripe Dashboard → Developers → Webhooks, add an endpoint
// pointing at `${your published URL}/api/stripe-webhook`, subscribe to:
//   checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted, invoice.payment_failed
// then copy the signing secret into STRIPE_WEBHOOK_SECRET (.env).

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type SubTier } from "@/lib/subscription.functions";

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key);
}

/**
 * Verifies the Stripe-Signature header ourselves (HMAC-SHA256 over
 * `${timestamp}.${rawBody}`) instead of pulling in the full `stripe` npm
 * package just for this — keeps the dependency list identical to the rest
 * of the codebase, which talks to Stripe over plain fetch throughout.
 */
async function verifyStripeSignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = parts["t"];
  const expectedSig = parts["v1"];
  if (!timestamp || !expectedSig) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`));
  const computedSig = Array.from(new Uint8Array(signed)).map((b) => b.toString(16).padStart(2, "0")).join("");

  // Reject timestamps older than 5 minutes to blunt replay attacks.
  const age = Date.now() / 1000 - Number(timestamp);
  if (age > 300) return false;

  return computedSig === expectedSig;
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
  POST: async ({ request }: { request: Request }) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured — refusing webhook");
      return new Response("Webhook not configured", { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const valid = await verifyStripeSignature(rawBody, signature, secret);
    if (!valid) {
      return new Response("Invalid signature", { status: 400 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid payload", { status: 400 });
    }

    const admin = adminClient();

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          if (session.mode === "payment" && session.client_reference_id && session.payment_status === "paid") {
            const { data: order } = await admin
              .from("orders")
              .update({ status: "paid", stripe_session_id: session.id })
              .eq("id", session.client_reference_id)
              .eq("status", "pending")
              .select("*")
              .single();

            // Notify the print/fulfillment supplier, if one is configured.
            // 🟠 this is a generic webhook dispatch, NOT a real integration
            // with any specific supplier's API — point SUPPLIER_WEBHOOK_URL
            // at whatever endpoint your actual print/fulfillment partner
            // gives you (or their own Zapier/Make webhook intake) and adjust
            // the payload shape to whatever they expect.
            const supplierUrl = process.env.SUPPLIER_WEBHOOK_URL;
            if (supplierUrl && order) {
              fetch(supplierUrl, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  orderId: order.id,
                  garmentDesignId: order.design_id,
                  priceCents: order.price_cents,
                  shipping: {
                    name: order.shipping_full_name,
                    phone: order.shipping_phone,
                    country: order.shipping_country,
                    city: order.shipping_city,
                    addressLine: order.shipping_address_line,
                    postalCode: order.shipping_postal_code,
                  },
                }),
              }).catch((err) => console.error("Supplier webhook dispatch failed:", err));
            }
          }
          break;
        }

        case "customer.subscription.updated": {
          const sub = event.data.object;
          // Read the tier from subscription metadata (set at checkout via
          // subscription_data[metadata][tier] in subscription.functions.ts)
          // instead of reverse-engineering it from the charged amount —
          // amount-matching breaks the moment currency/pricing varies.
          const tier = (sub.metadata?.tier as SubTier | undefined) ?? null;
          const active = sub.status === "active" || sub.status === "trialing";
          if (tier && active) {
            await admin
              .from("profiles")
              .update({
                subscription_tier: tier,
                stripe_subscription_id: sub.id,
                subscription_renews_at: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
              })
              .eq("stripe_customer_id", sub.customer);
          } else if (!active) {
            await admin
              .from("profiles")
              .update({ subscription_tier: "free", subscription_renews_at: null })
              .eq("stripe_customer_id", sub.customer);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object;
          // This is THE critical fix for the "cancel in Stripe Portal
          // doesn't downgrade us" gap called out in the project review.
          await admin
            .from("profiles")
            .update({ subscription_tier: "free", stripe_subscription_id: null, subscription_renews_at: null })
            .eq("stripe_customer_id", sub.customer);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          // Don't downgrade instantly on a single failed charge (Stripe
          // retries automatically) — just log it. A real "past_due" banner
          // in the UI can read this from profiles.subscription_renews_at
          // being in the past, without needing a new column.
          console.warn(`Payment failed for customer ${invoice.customer}, invoice ${invoice.id}`);
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error("Stripe webhook handler error:", err);
      return new Response("Handler error", { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
  },
    },
  },
});
