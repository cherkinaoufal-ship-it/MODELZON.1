import { supabase } from "./supabase";

export type ProductionMeasurements = {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  city: string;
  district: string;
  streetAddress: string;
  landmark: string;
  postalCode: string;
  heightCm: number | null;
  chestCm: number | null;
  garmentSize: string;
  fabricPreference: string;
  note: string;
};

/**
 * "Request real-life production" — the owner of a design asking MODELZON
 * (or its print/fulfillment partner) to actually manufacture it for them,
 * separate from listing it on the marketplace for other people to buy.
 * Captures what a sewing/print partner needs to both CUT the garment
 * (height, chest, size, fabric) AND actually DELIVER it (city, district,
 * street address, a nearby landmark, postal code) — the delivery fields
 * were missing entirely before, which meant a real courier had no way to
 * find the person. This creates a request record for a human to follow up
 * on — it does NOT automatically charge anyone or guarantee production,
 * since that depends on your actual manufacturing/print partner
 * relationship (see the SUPPLIER_WEBHOOK_URL notes in stripe-webhook.ts).
 */
export async function requestProduction(designId: string, userId: string, m: ProductionMeasurements): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from("production_requests").insert({
    design_id: designId,
    user_id: userId,
    first_name: m.firstName,
    last_name: m.lastName,
    phone: m.phone,
    country: m.country,
    city: m.city,
    district: m.district,
    street_address: m.streetAddress,
    landmark: m.landmark,
    postal_code: m.postalCode,
    height_cm: m.heightCm,
    chest_cm: m.chestCm,
    garment_size: m.garmentSize,
    fabric_preference: m.fabricPreference,
    note: m.note,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
