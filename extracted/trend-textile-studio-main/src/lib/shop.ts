import { supabase } from "./supabase";

export type Shop = {
  user_id: string;
  shop_name: string;
  tagline: string;
  banner_from: string;
  banner_to: string;
};

export async function getMyShop(userId: string): Promise<Shop | null> {
  const { data } = await supabase.from("shops").select("*").eq("user_id", userId).maybeSingle();
  return data as Shop | null;
}

export async function upsertShop(shop: Shop): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from("shops").upsert(shop, { onConflict: "user_id" });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
