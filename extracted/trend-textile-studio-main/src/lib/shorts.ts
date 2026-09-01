import { supabase } from "./supabase";

export type ShortVideo = {
  id: string;
  user_id: string;
  username: string;
  video_url: string;
  caption: string;
  garment: string | null;
  likes_count: number;
  created_at: string;
};

export async function fetchShorts(): Promise<ShortVideo[]> {
  const { data, error } = await supabase.from("shorts").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return [];
  return data as ShortVideo[];
}

/**
 * Uploads a video file straight to Supabase Storage (no MODELZON-imposed
 * size cap — see the `shorts-videos` bucket's file_size_limit in
 * 016_shorts.sql for the real ceiling) and creates the matching feed row.
 * Reports upload progress via `onProgress` (0-100) since video files can
 * take a while — a plain spinner isn't good enough feedback for a 200MB
 * upload on a slow connection.
 */
export async function uploadShort(input: {
  userId: string;
  username: string;
  file: File;
  caption: string;
  garment: string | null;
  onProgress?: (pct: number) => void;
}): Promise<{ ok: boolean; message?: string }> {
  const ext = input.file.name.split(".").pop() || "mp4";
  const path = `${input.userId}/${Date.now()}.${ext}`;

  // supabase-js's storage upload doesn't expose progress callbacks directly
  // in all versions — XHR gives real progress reporting for large files
  // without needing an extra dependency.
  const { data: signed, error: signErr } = await supabase.storage.from("shorts-videos").createSignedUploadUrl(path);
  if (signErr || !signed) return { ok: false, message: signErr?.message ?? "Could not start upload" };

  const ok = await new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.signedUrl);
    xhr.setRequestHeader("Content-Type", input.file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) input.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(input.file);
  });
  if (!ok) return { ok: false, message: "Upload failed — check your connection and try again." };

  const { data: pub } = supabase.storage.from("shorts-videos").getPublicUrl(path);

  const { error: insertErr } = await supabase.from("shorts").insert({
    user_id: input.userId,
    username: input.username,
    video_url: pub.publicUrl,
    caption: input.caption,
    garment: input.garment,
  });
  if (insertErr) return { ok: false, message: insertErr.message };

  return { ok: true };
}

export async function toggleShortLike(shortId: string, userId: string, currentlyLiked: boolean): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await supabase.from("short_likes").delete().eq("short_id", shortId).eq("user_id", userId);
    return !error;
  }
  const { error } = await supabase.from("short_likes").insert({ short_id: shortId, user_id: userId });
  return !error;
}

export async function fetchMyLikedShortIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("short_likes").select("short_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.short_id as string));
}
