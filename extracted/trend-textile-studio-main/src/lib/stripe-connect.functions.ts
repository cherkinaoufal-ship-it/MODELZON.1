import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Stripe Connect (Express accounts) — lets sellers receive their share of a
 * sale directly instead of everything sitting in the platform's own Stripe
 * balance. This is what makes "Elite = zero commission" and the standard
 * 15% platform commission (see PLATFORM_COMMISSION_RATE in
 * stripe.functions.ts) actually payable to the seller, not just a number
 * shown in the UI.
 */

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key);
}

const OnboardInput = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  origin: z.string().url(),
});

/**
 * Ensures the user has a Stripe Connect Express account (creating one on
 * first call), then returns a fresh onboarding link. Stripe onboarding
 * links expire quickly and are single-use, so this always mints a new one
 * rather than caching it.
 */
export const createConnectOnboardingLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OnboardInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
    const admin = adminClient();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", data.userId)
      .single();
    if (profileErr) throw new Error(profileErr.message);

    let accountId = profile?.stripe_connect_account_id as string | null;

    if (!accountId) {
      const res = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          type: "express",
          email: data.email,
          "capabilities[card_payments][requested]": "true",
          "capabilities[transfers][requested]": "true",
          "metadata[modelzon_user_id]": data.userId,
        }),
      });
      if (!res.ok) throw new Error(`Stripe error ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const account = await res.json();
      accountId = account.id as string;

      const { error: saveErr } = await admin.from("profiles").update({ stripe_connect_account_id: accountId }).eq("id", data.userId);
      if (saveErr) throw new Error(saveErr.message);
    }

    const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        account: accountId,
        refresh_url: `${data.origin}/?connect=refresh`,
        return_url: `${data.origin}/?connect=return`,
        type: "account_onboarding",
      }),
    });
    if (!linkRes.ok) throw new Error(`Stripe error ${linkRes.status}: ${(await linkRes.text()).slice(0, 300)}`);
    const link = await linkRes.json();
    return { url: link.url as string };
  });

const StatusInput = z.object({ userId: z.string().uuid() });

/**
 * Called when the seller lands back on `?connect=return` — re-checks the
 * account's real status with Stripe (never trust the redirect alone, the
 * user could bail out mid-onboarding) and syncs charges/payouts flags.
 */
export const syncConnectStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
    const admin = adminClient();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", data.userId)
      .single();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile?.stripe_connect_account_id) return { connected: false, chargesEnabled: false, payoutsEnabled: false };

    const res = await fetch(`https://api.stripe.com/v1/accounts/${profile.stripe_connect_account_id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`Stripe error ${res.status}`);
    const account = await res.json();

    const { error: updateErr } = await admin
      .from("profiles")
      .update({
        stripe_connect_charges_enabled: Boolean(account.charges_enabled),
        stripe_connect_payouts_enabled: Boolean(account.payouts_enabled),
      })
      .eq("id", data.userId);
    if (updateErr) throw new Error(updateErr.message);

    return { connected: true, chargesEnabled: Boolean(account.charges_enabled), payoutsEnabled: Boolean(account.payouts_enabled) };
  });
