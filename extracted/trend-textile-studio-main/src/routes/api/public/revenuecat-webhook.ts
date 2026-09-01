// MODELZON — RevenueCat webhook endpoint (Android Google Play Billing sync).
//
// ⚠️ Same TanStack Start API-route caveat as stripe-webhook.ts — verify
// `createServerFileRoute` against the installed @tanstack/react-start
// version by running the dev server once; this could not be built/tested
// in this offline sandbox.
//
// SETUP: RevenueCat dashboard → Project → Integrations → Webhooks →
// add `${published URL}/api/revenuecat-webhook`, and set an Authorization
// header value there that matches REVENUECAT_WEBHOOK_AUTH (.env) — this is
// how we authenticate the incoming request (RevenueCat has no HMAC
// signature scheme like Stripe's, so a shared-secret header is their
// documented approach).
//
// We look up the profile by app_user_id, which we set to the Supabase user
// id itself in revenuecat.ts (`Purchases.configure({ appUserID: userId })`),
// so no extra mapping table is needed.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { SubTier } from "@/lib/subscription.functions";

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key);
}

const PRODUCT_TO_TIER: Record<string, SubTier> = {
  modelzon_basic_monthly: "basic",
  modelzon_pro_monthly: "pro",
  modelzon_elite_monthly: "elite",
};

export const Route = createFileRoute("/api/public/revenuecat-webhook")({
  server: {
    handlers: {
  POST: async ({ request }: { request: Request }) => {
    const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
    if (!expected) {
      console.error("REVENUECAT_WEBHOOK_AUTH not configured — refusing webhook");
      return new Response("Webhook not configured", { status: 500 });
    }
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${expected}` && authHeader !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid payload", { status: 400 });
    }

    const event = body?.event;
    if (!event) return new Response("Missing event", { status: 400 });

    const appUserId: string | undefined = event.app_user_id;
    const productId: string | undefined = event.product_id;
    const tier = productId ? PRODUCT_TO_TIER[productId] : undefined;
    const admin = adminClient();

    try {
      switch (event.type) {
        case "INITIAL_PURCHASE":
        case "RENEWAL":
        case "UNCANCELLATION":
        case "PRODUCT_CHANGE": {
          if (!appUserId || !tier) break;
          const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
          await admin
            .from("profiles")
            .update({ subscription_tier: tier, subscription_source: "revenuecat_android", subscription_renews_at: expiresAt })
            .eq("id", appUserId);
          break;
        }

        case "CANCELLATION":
          // User cancelled but keeps access until expiration — don't
          // downgrade yet, EXPIRATION will do that when the period truly ends.
          break;

        case "EXPIRATION": {
          if (!appUserId) break;
          await admin
            .from("profiles")
            .update({ subscription_tier: "free", subscription_source: null, subscription_renews_at: null })
            .eq("id", appUserId);
          break;
        }

        case "BILLING_ISSUE":
          console.warn(`RevenueCat billing issue for user ${appUserId}`);
          break;

        default:
          break;
      }
    } catch (err) {
      console.error("RevenueCat webhook handler error:", err);
      return new Response("Handler error", { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
  },
    },
  },
});
