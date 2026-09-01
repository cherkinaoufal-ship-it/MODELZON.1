import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/** §9b — Friend REQUESTS on top of the direct friendships table.
 *
 *  Flow: tapping "+" on a player's inspection card sends a pending request
 *  (the sender's button turns into an hourglass). The receiver sees it in
 *  Profile → Friends → requests, and accepts or declines. Accepting writes
 *  BOTH friendship directions (public.friendships) so the existing
 *  listFriends/removeFriend keep working untouched.
 *
 *  Expiry: pending requests die after 30 days — enforced by a nightly
 *  pg_cron sweeper (see 20260901000000_friend_requests.sql) AND re-checked
 *  here on read/respond, so it holds even without cron.
 *
 *  Tier gating stays identical to the clan perk (FRIEND_LIMIT in
 *  friends.functions.ts): sending requires a Pro/Elite sender; accepting
 *  counts against the receiver's clan cap. */

const REQUEST_TTL_DAYS = 30;

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key);
}

async function friendLimitOf(admin: ReturnType<typeof adminClient>, userId: string): Promise<number> {
  const FRIEND_LIMIT: Record<string, number> = { free: 0, basic: 0, pro: 10, elite: 25 };
  const { data: me } = await admin.from("profiles").select("subscription_tier").eq("id", userId).single();
  return FRIEND_LIMIT[me?.subscription_tier ?? "free"] ?? 0;
}

const SendInput = z.object({ userId: z.string().uuid(), targetId: z.string().uuid() });

export const sendFriendRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SendInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    if (data.userId === data.targetId) throw new Error("You can't add yourself.");

    // Sending requires a plan that allows a clan at all (same gate as
    // addFriend — the request ends in a friendship either way).
    const limit = await friendLimitOf(admin, data.userId);
    if (limit === 0) throw new Error("Subscribe to Pro or Elite to unlock a friends list.");

    // Already friends (either direction)? Nothing to request.
    const { count: friendCount } = await admin.from("friendships").select("friend_id", { count: "exact", head: true })
      .eq("user_id", data.userId).eq("friend_id", data.targetId);
    const { count: friendCountReverse } = await admin.from("friendships").select("user_id", { count: "exact", head: true })
      .eq("user_id", data.targetId).eq("friend_id", data.userId);
    if ((friendCount ?? 0) > 0 || (friendCountReverse ?? 0) > 0) throw new Error("Already in your clan.");

    // If THEY already sent us a pending request, this "+" is a mutual yes —
    // accept theirs on the spot instead of creating a deadlock pair.
    const { data: reverse } = await admin.from("friend_requests")
      .select("id")
      .eq("sender_id", data.targetId).eq("receiver_id", data.userId).eq("status", "pending")
      .gt("created_at", new Date(Date.now() - REQUEST_TTL_DAYS * 86400_000).toISOString())
      .maybeSingle();
    if (reverse) {
      await acceptRequestRow(admin, reverse.id, data.userId);
      return { ok: true, status: "accepted" as const };
    }

    // Re-send / refresh: an old pending or declined request from me gets
    // revived with a fresh 30-day window instead of failing the unique key.
    const { error } = await admin.from("friend_requests").upsert(
      {
        sender_id: data.userId,
        receiver_id: data.targetId,
        status: "pending",
        created_at: new Date().toISOString(),
        responded_at: null,
      },
      { onConflict: "sender_id,receiver_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, status: "pending" as const };
  });

const RespondInput = z.object({ requestId: z.string().uuid(), userId: z.string().uuid(), accept: z.boolean() });

export const respondFriendRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RespondInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { data: req, error } = await admin.from("friend_requests").select("id, sender_id, receiver_id, created_at, status").eq("id", data.requestId).maybeSingle();
    if (error || !req) throw new Error("Request not found.");
    if (req.receiver_id !== data.userId) throw new Error("Not your request to answer.");
    if (req.status !== "pending") throw new Error("Already answered.");
    if (new Date(req.created_at).getTime() < Date.now() - REQUEST_TTL_DAYS * 86400_000) {
      await admin.from("friend_requests").delete().eq("id", req.id);
      throw new Error("This request expired (30 days).");
    }

    if (!data.accept) {
      await admin.from("friend_requests").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", req.id);
      return { ok: true, status: "declined" as const };
    }
    await acceptRequestRow(admin, req.id, data.userId);
    return { ok: true, status: "accepted" as const };
  });

/** Shared "accept" path: checks the RECEIVER's clan cap, writes both
 *  friendship directions, closes the request row. */
async function acceptRequestRow(admin: ReturnType<typeof adminClient>, requestId: string, receiverId: string) {
  const { data: req } = await admin.from("friend_requests").select("sender_id, receiver_id").eq("id", requestId).single();
  if (!req) throw new Error("Request not found.");

  const limit = await friendLimitOf(admin, receiverId);
  if (limit === 0) throw new Error("Accepting requires a Pro or Elite plan.");
  const { count } = await admin.from("friendships").select("friend_id", { count: "exact", head: true }).eq("user_id", receiverId);
  if ((count ?? 0) >= limit) throw new Error(`Your clan is full (${limit} max on your plan).`);

  // Mutual friendship = both directional rows, inserted atomically-ish with
  // conflicts tolerated (idempotent re-accepts / races with direct addFriend).
  await admin.from("friendships").upsert(
    [
      { user_id: req.sender_id, friend_id: req.receiver_id },
      { user_id: req.receiver_id, friend_id: req.sender_id },
    ],
    { onConflict: "user_id,friend_id" },
  );
  await admin.from("friend_requests").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", requestId);
}

const ListInput = z.object({ userId: z.string().uuid() });

export type FriendRequestSummary = {
  id: string;
  senderId: string;
  username: string;
  level: number;
  avatarUrl: string | null;
  createdAt: string;
};

export const listIncomingFriendRequests = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { data: rows, error } = await admin
      .from("friend_requests")
      .select("id, sender_id, created_at")
      .eq("receiver_id", data.userId)
      .eq("status", "pending")
      .gt("created_at", new Date(Date.now() - REQUEST_TTL_DAYS * 86400_000).toISOString())
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [] as FriendRequestSummary[];

    // profiles fetched separately (FK points at auth.users — same reason as
    // listFriends in friends.functions.ts).
    const ids = rows.map((r) => r.sender_id as string);
    const { data: profiles } = await admin.from("profiles").select("id, username, level, avatar_url").in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return rows.flatMap((r) => {
      const p = byId.get(r.sender_id);
      return p ? [{
        id: r.id as string,
        senderId: r.sender_id as string,
        username: p.username ?? "Player",
        level: p.level ?? 1,
        avatarUrl: p.avatar_url ?? null,
        createdAt: r.created_at as string,
      }] : [];
    });
  });

const StatusInput = z.object({ userId: z.string().uuid(), targetId: z.string().uuid() });

/** Hourglass state for the sender's "+" button on an inspection card. */
export const getOutgoingFriendRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StatusInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { data: row } = await admin.from("friend_requests")
      .select("status, created_at")
      .eq("sender_id", data.userId).eq("receiver_id", data.targetId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row || row.status !== "pending") return { status: "none" as const };
    if (new Date(row.created_at as string).getTime() < Date.now() - REQUEST_TTL_DAYS * 86400_000) {
      return { status: "none" as const };
    }
    return { status: "pending" as const };
  });
