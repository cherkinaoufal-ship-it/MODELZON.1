import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/** Friend list caps, by subscription tier — the "Clan" perk mentioned in
 *  the Pro/Elite subscription cards. Free/Basic don't get a clan at all;
 *  this is a real gated perk, not just cosmetic. */
export const FRIEND_LIMIT: Record<string, number> = { free: 0, basic: 0, pro: 10, elite: 25 };

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key);
}

const AddFriendInput = z.object({ userId: z.string().uuid(), friendPlayerId: z.string().min(3) });

/** Adds a friend by their player ID (the short `MZ-XXXXXX#` code already
 *  shown on every profile) rather than requiring an exact username match —
 *  same lookup a game "add friend by ID" flow uses. */
export const addFriend = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AddFriendInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();

    const { data: me } = await admin.from("profiles").select("subscription_tier").eq("id", data.userId).single();
    const limit = FRIEND_LIMIT[me?.subscription_tier ?? "free"] ?? 0;
    if (limit === 0) throw new Error("Subscribe to Pro or Elite to unlock a friends list.");

    const { count } = await admin.from("friendships").select("friend_id", { count: "exact", head: true }).eq("user_id", data.userId);
    if ((count ?? 0) >= limit) throw new Error(`Your clan is full (${limit} max on your plan).`);

    const cleanId = data.friendPlayerId.replace(/^MZ-/i, "").replace(/#$/, "").toLowerCase();
    // Player IDs are just the first 6 characters of the account's UUID
    // (see playerId in index.tsx) — no separate column to keep in sync,
    // so look up by UUID prefix instead.
    const { data: candidates, error: findErr } = await admin.from("profiles").select("id").ilike("id", `${cleanId}%`).limit(2);
    if (findErr || !candidates || candidates.length === 0) throw new Error("No player found with that ID.");
    if (candidates.length > 1) throw new Error("That ID matches more than one player — ask them for their full ID.");
    const friend = candidates[0];
    if (friend.id === data.userId) throw new Error("You can't add yourself.");

    const { error } = await admin.from("friendships").insert({ user_id: data.userId, friend_id: friend.id });
    if (error) {
      if (error.code === "23505") throw new Error("Already in your clan.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

const RemoveFriendInput = z.object({ userId: z.string().uuid(), friendId: z.string().uuid() });

export const removeFriend = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RemoveFriendInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    await admin.from("friendships").delete().eq("user_id", data.userId).eq("friend_id", data.friendId);
    return { ok: true };
  });

const ListFriendsInput = z.object({ userId: z.string().uuid() });

export const listFriends = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ListFriendsInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { data: rows, error } = await admin.from("friendships").select("friend_id").eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.friend_id as string);
    if (ids.length === 0) return [];
    // Fetched separately rather than as an embedded join — the
    // friendships.friend_id FK points at auth.users, not public.profiles,
    // so PostgREST can't auto-embed profiles through it reliably.
    const { data: profiles, error: profErr } = await admin.from("profiles").select("id, username, level, avatar_url").in("id", ids);
    if (profErr) throw new Error(profErr.message);
    return profiles ?? [];
  });
