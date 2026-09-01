import { supabase } from "./supabase";

export type MarketplaceListing = {
  id: string;
  user_id: string;
  garment: string;
  size: string;
  color: string;
  decal_url: string | null;
  title: string;
  price_cents: number;
  seller_username: string;
};

/** Flip a design you own to "for sale" at the given price. Level 50+ is
 * enforced server-side by a DB trigger, not just here — see 003_marketplace.sql. */
export async function listDesignForSale(designId: string, priceCents: number): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from("designs").update({ for_sale: true, price_cents: priceCents }).eq("id", designId);
  if (error) return { ok: false, message: error.message.includes("Level 50") ? "لازم تكون مستوى 50 عشان تبيع تصاميمك" : error.message };
  return { ok: true };
}

export async function unlistDesign(designId: string): Promise<boolean> {
  const { error } = await supabase.from("designs").update({ for_sale: false }).eq("id", designId);
  return !error;
}

export async function fetchMarketplace(): Promise<MarketplaceListing[]> {
  // designs.for_sale=true rows are readable by anyone (see RLS policy),
  // but we still need the seller's display name, which lives in profiles.
  const { data, error } = await supabase
    .from("designs")
    .select("id, user_id, garment, size, color, decal_url, title, price_cents, profiles!designs_user_id_fkey(username)")
    .eq("for_sale", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load marketplace:", error.message);
    return [];
  }
  return (data as any[]).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    garment: row.garment,
    size: row.size,
    color: row.color,
    decal_url: row.decal_url,
    title: row.title,
    price_cents: row.price_cents,
    seller_username: row.profiles?.username ?? "Player",
  }));
}

/**
 * Creates a "pending" order row. This is Phase 4a — it records the buyer's
 * intent to purchase, but does NOT charge any money yet. Actually taking
 * payment requires a Stripe account + a server-side secret key, which is
 * Phase 4b (a real payment can't be safely triggered from browser code
 * alone — the secret key must never reach the client).
 */
export type ShippingInput = {
  fullName: string;
  phone: string;
  country: string;
  city: string;
  addressLine: string;
  postalCode?: string;
};

export async function createPendingOrder(input: {
  designId: string;
  buyerId: string;
  sellerId: string;
  priceCents: number;
  shipping: ShippingInput;
}): Promise<{ ok: boolean; orderId?: string; message?: string }> {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      design_id: input.designId,
      buyer_id: input.buyerId,
      seller_id: input.sellerId,
      price_cents: input.priceCents,
      status: "pending",
      shipping_full_name: input.shipping.fullName,
      shipping_phone: input.shipping.phone,
      shipping_country: input.shipping.country,
      shipping_city: input.shipping.city,
      shipping_address_line: input.shipping.addressLine,
      shipping_postal_code: input.shipping.postalCode || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, orderId: data.id as string };
}
