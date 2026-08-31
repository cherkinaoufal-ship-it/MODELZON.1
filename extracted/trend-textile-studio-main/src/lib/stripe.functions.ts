import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { convertUsdCentsToCurrency, type CurrencyCode } from "./currency";

const CreateSessionInput = z.object({
  orderId: z.string().uuid(),
  sellerId: z.string().uuid(),
  title: z.string().min(1).max(200),
  priceCents: z.number().int().positive(),
  origin: z.string().url(),
  currency: z.string().length(3).optional(),
});

/** Platform commission on marketplace sales. Elite subscribers keep the
 * "zero_commission" perk (see TIER_PERKS in subscription.functions.ts). */
const PLATFORM_COMMISSION_RATE = 0.15;

/**
 * Creates a real Stripe Checkout Session for one order and returns the
 * hosted payment page URL. The secret key never leaves the server — this
 * function runs server-side only (createServerFn).
 *
 * When the seller has a connected Stripe Connect account, this uses a
 * "destination charge": the buyer pays MODELZON's platform account, Stripe
 * automatically splits `priceCents - applicationFee` to the seller's
 * connected account, and MODELZON keeps the application fee. If the seller
 * hasn't finished Connect onboarding yet, the sale still goes through (money
 * stays on the platform account) but the app should nudge them to onboard —
 * see stripe-connect.functions.ts.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateSessionInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase service-role configuration");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: seller, error: sellerErr } = await admin
      .from("profiles")
      .select("subscription_tier, stripe_connect_account_id, stripe_connect_charges_enabled")
      .eq("id", data.sellerId)
      .single();
    if (sellerErr) throw new Error(sellerErr.message);

    const sellerIsElite = seller?.subscription_tier === "elite";
    const sellerConnected = Boolean(seller?.stripe_connect_account_id) && seller?.stripe_connect_charges_enabled;

    // Convert to the buyer's chosen currency BEFORE computing the platform
    // fee — application_fee_amount must be in the same currency as the
    // charge itself, or Stripe rejects the whole session.
    const currency = (data.currency?.toUpperCase() ?? "USD") as CurrencyCode;
    const chargeAmount = currency === "USD" ? data.priceCents : convertUsdCentsToCurrency(data.priceCents, currency);
    const applicationFeeCents = sellerIsElite ? 0 : Math.round(chargeAmount * PLATFORM_COMMISSION_RATE);

    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(chargeAmount),
      "line_items[0][price_data][product_data][name]": data.title,
      success_url: `${data.origin}/?checkout=success&order=${data.orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/?checkout=cancel&order=${data.orderId}`,
      client_reference_id: data.orderId,
    });

    // Only attach Connect params if the seller has actually completed
    // onboarding — otherwise Stripe rejects the session outright.
    if (sellerConnected) {
      body.set("payment_intent_data[application_fee_amount]", String(applicationFeeCents));
      body.set("payment_intent_data[transfer_data][destination]", seller!.stripe_connect_account_id as string);
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Stripe error ${res.status}: ${text.slice(0, 300)}`);
    }

    const session = await res.json();

    // Record the fee/destination we intended, for support/audit purposes —
    // confirmCheckoutSession re-verifies against Stripe itself before ever
    // marking the order paid, so this is informational, not trust-bearing.
    // Note: application_fee_cents is in the ORDER'S CHARGE CURRENCY (see
    // `currency` above), not always USD — check orders.seller_stripe_account_id's
    // related Stripe charge for the authoritative currency if reconciling.
    await admin
      .from("orders")
      .update({
        application_fee_cents: sellerConnected ? applicationFeeCents : 0,
        seller_stripe_account_id: sellerConnected ? seller!.stripe_connect_account_id : null,
      })
      .eq("id", data.orderId);

    return { url: session.url as string };
  });

const ConfirmInput = z.object({
  sessionId: z.string().min(1),
  orderId: z.string().uuid(),
});

/**
 * Verifies payment directly with Stripe (server-to-server, trusted) and,
 * only if Stripe confirms it as paid, updates the order using the
 * service-role Supabase client — which bypasses RLS. This is the only
 * path that can ever mark an order "paid"; there is no client-side policy
 * that allows it, so a buyer can't fake this from the browser.
 */
export const confirmCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ConfirmInput.parse(d))
  .handler(async ({ data }) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase service-role configuration");

    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(data.sessionId)}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (!res.ok) throw new Error(`Stripe error ${res.status}`);
    const session = await res.json();

    const paid = session.payment_status === "paid" && session.client_reference_id === data.orderId;

    if (paid) {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { error } = await admin
        .from("orders")
        .update({ status: "paid", stripe_session_id: data.sessionId })
        .eq("id", data.orderId)
        .eq("status", "pending"); // idempotent: won't double-process on refresh
      if (error) throw new Error(error.message);
    }

    return { paid };
  });
