import { supabase } from "./supabase";

/** The `avatars` bucket is private (public buckets are disabled on this
 *  workspace), so a plain public URL renders as a broken image — that was
 *  the "avatar shows a broken icon after changing it" bug. We hand out a
 *  long-lived signed URL instead and store that on the profile. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // 5 years

/** Re-signs a stored avatar path if the saved URL has gone stale. */
export async function signedAvatarUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return null;
  return data.signedUrl;
}

export async function uploadAvatar(userId: string, file: File): Promise<{ ok: boolean; url?: string; message?: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type || undefined });
  if (uploadErr) return { ok: false, message: uploadErr.message };

  const url = await signedAvatarUrl(path);
  if (!url) return { ok: false, message: "Could not create an image link" };

  const { error: profileErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (profileErr) return { ok: false, message: profileErr.message };

  return { ok: true, url };
}
