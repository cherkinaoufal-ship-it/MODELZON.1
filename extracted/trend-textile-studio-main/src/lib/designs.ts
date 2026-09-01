import { supabase } from "./supabase";
import type { GarmentType, SizeId } from "@/components/Studio3D";
import type { DecalTransform } from "@/components/modelzon/DecalControls";
import type { Json } from "@/integrations/supabase/types";

export type SavedDesign = {
  id: string;
  user_id: string;
  garment: string;
  size: string;
  color: string;
  decal_url: string | null;
  decal_transform: DecalTransform | null;
  decal_url_back: string | null;
  decal_transform_back: DecalTransform | null;
  title: string;
  fingerprint: string;
  for_sale: boolean;
  price_cents: number | null;
  created_at: string;
};

/**
 * Builds a stable fingerprint from exactly the attributes the person asked
 * us to treat as "the same design": garment shape, size, base color, the
 * front decal (image + placement), the back decal (image + placement,
 * independent of the front one), AND the hand-painted brush layer
 * (paintDataUrl). Two saves with identical values across all of this hash
 * to the same string.
 */
export async function computeFingerprint(input: {
  garment: GarmentType;
  size: SizeId;
  color: string;
  decalUrl: string | null;
  decalTransform: DecalTransform | null;
  decalUrlBack?: string | null;
  decalTransformBack?: DecalTransform | null;
  paintDataUrl?: string | null;
}): Promise<string> {
  const stringifyTransform = (t: DecalTransform | null) =>
    t ? [t.x.toFixed(3), t.y.toFixed(3), t.scale.toFixed(3), t.rotation.toFixed(3)].join(",") : "";

  const parts = [
    input.garment,
    input.size,
    input.color.toLowerCase(),
    input.decalUrl ?? "",
    stringifyTransform(input.decalTransform),
    input.decalUrlBack ?? "",
    stringifyTransform(input.decalTransformBack ?? null),
    input.paintDataUrl ?? "",
  ].join("|");

  const bytes = new TextEncoder().encode(parts);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type SaveDesignResult = { ok: true; design: SavedDesign } | { ok: false; reason: "duplicate" | "error"; message: string };

export async function saveDesign(input: {
  userId: string;
  garment: GarmentType;
  size: SizeId;
  color: string;
  decalUrl: string | null;
  decalTransform: DecalTransform | null;
  decalUrlBack?: string | null;
  decalTransformBack?: DecalTransform | null;
  title: string;
  paintDataUrl?: string | null;
}): Promise<SaveDesignResult> {
  const fingerprint = await computeFingerprint(input);

  const { data, error } = await supabase
    .from("designs")
    .insert({
      user_id: input.userId,
      garment: input.garment,
      size: input.size,
      color: input.color,
      decal_url: input.decalUrl,
      decal_transform: input.decalTransform as unknown as Json,
      decal_url_back: input.decalUrlBack ?? null,
      decal_transform_back: (input.decalTransformBack ?? null) as unknown as Json,
      title: input.title,
      fingerprint,
    })
    .select()
    .single();

  if (error) {
    // Postgres unique_violation on the fingerprint column.
    if (error.code === "23505") {
      return { ok: false, reason: "duplicate", message: "هذا التصميم بالضبط (نفس الشكل واللون والرسمة) محفوظ مسبقاً — غيّر شي فيه." };
    }
    return { ok: false, reason: "error", message: error.message };
  }

  return { ok: true, design: data as SavedDesign };
}

export async function listMyDesigns(userId: string): Promise<SavedDesign[]> {
  const { data, error } = await supabase
    .from("designs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load designs:", error.message);
    return [];
  }
  return data as SavedDesign[];
}

export async function deleteDesign(id: string): Promise<boolean> {
  const { error } = await supabase.from("designs").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete design:", error.message);
    return false;
  }
  return true;
}
