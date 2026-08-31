import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { convertUsdCentsToCurrency, type CurrencyCode } from "./currency";

export const TIER_PRICES_CENTS = { basic: 699, pro: 1499, elite: 2400 } as const;
export type SubTier = keyof typeof TIER_PRICES_CENTS;

export const TIER_PERKS: Record<SubTier, string[]> = {
  basic: ["subscriber_badge", "arena_priority"],
  pro: ["subscriber_badge", "arena_priority", "exclusive_studio_items", "instant_verified", "friends_clan"],
  elite: ["subscriber_badge", "arena_priority", "exclusive_studio_items", "instant_verified", "friends_clan", "sell_below_level_50", "zero_commission"],
};

const CreateSubInput = z.object({
  tier: z.enum(["basic", "pro", "elite"]),
  userId: z.string().uuid(),
  origin: z.string().url(),
  /** Which currency to actually charge in — defaults to USD if omitted so
   *  nothing breaks for callers that predate the currency picker. */
  currency: z.string().length(3).optional(),
});

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateSubInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

    const currency = (data.currency?.toUpperCase() ?? "USD") as CurrencyCode;
    const usdCents = TIER_PRICES_CENTS[data.tier];
    const chargeAmount = currency === "USD" ? usdCents : convertUsdCentsToCurrency(usdCents, currency);

    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(chargeAmount),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": `MODELZON ${data.tier.toUpperCase()} Plan`,
      // Tag the subscription itself with which tier this is — the webhook
      // reads this directly (sub.metadata.tier) instead of trying to
      // reverse-engineer the tier from the charged amount, which breaks
      // the moment two different tiers can cost the same in some currency,
      // or the same tier is charged in different currencies.
      "subscription_data[metadata][tier]": data.tier,
      success_url: `${data.origin}/?sub=success&tier=${data.tier}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/?sub=cancel`,
      client_reference_id: data.userId,
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Stripe error ${res.status}: ${text.slice(0, 300)}`);
    }
    const session = await res.json();
    return { url: session.url as string };
  });

const ConfirmSubInput = z.object({
  sessionId: z.string().min(1),
  userId: z.string().uuid(),
  tier: z.enum(["basic", "pro", "elite"]),
});

export const confirmSubscriptionCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ConfirmSubInput.parse(d))
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

    const active = session.status === "complete" && session.client_reference_id === data.userId && session.subscription;
    if (!active) return { active: false };

    // Pull the renewal date from the subscription object itself.
    let renewsAt: string | null = null;
    const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (subRes.ok) {
      const sub = await subRes.json();
      if (sub.current_period_end) renewsAt = new Date(sub.current_period_end * 1000).toISOString();
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await admin
      .from("profiles")
      .update({
        subscription_tier: data.tier,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        subscription_renews_at: renewsAt,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    return { active: true };
  });

/**
 * Opens Stripe's hosted "Customer Portal" so a subscriber can cancel or
 * change their plan on Stripe's own secure page — we don't need to build
 * cancellation UI ourselves. A cancellation made here now DOES sync back
 * automatically: src/routes/api/stripe-webhook.ts listens for
 * customer.subscription.deleted/updated and downgrades subscription_tier
 * the moment Stripe confirms it, independent of whether the person ever
 * visits the app again.
 */
const PortalInput = z.object({ customerId: z.string().min(1), origin: z.string().url() });

export const openBillingPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PortalInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ customer: data.customerId, return_url: data.origin }),
    });
    if (!res.ok) throw new Error(`Stripe error ${res.status}`);
    const portal = await res.json();
    return { url: portal.url as string };
  });
