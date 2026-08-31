import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Real 4-player battle rooms — matchmaking, a synced design timer, and
 * AI-judged, ranked results with real point stakes (top 2 gain, bottom 2
 * lose a little — genuine multiplayer, not everyone just getting a
 * participation score). See 015_battle_rooms.sql for the schema this
 * relies on and why every state transition happens here (server) instead
 * of being set directly by a client.
 */

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key);
}

const MAX_PLAYERS = 4;
const COUNTDOWN_SECONDS = 15;
const DESIGN_MINUTES = 10;

// Rank-point stakes: 1st/2nd gain, 3rd/4th lose a little — real
// win/lose stakes rather than everyone drifting upward regardless of
// how they placed.
const PLACEMENT_DELTA: Record<number, number> = { 1: 120, 2: 60, 3: -15, 4: -25 };

const JoinInput = z.object({
  userId: z.string().uuid(),
  username: z.string().min(1),
  level: z.number().int(),
  topic: z.string().min(1),
  garment: z.string().min(1),
});

/**
 * Finds an open ('waiting', not full) room for this topic+garment, or
 * creates one, then joins the caller to it. When the 4th player joins, the
 * room immediately moves to 'countdown'. Safe to call again if a client
 * reconnects — it just returns their existing room if they're already in
 * one that hasn't finished yet.
 */
export const joinBattleRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => JoinInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();

    const { data: existingMembership } = await admin
      .from("battle_room_members")
      .select("room_id, battle_rooms!inner(status)")
      .eq("user_id", data.userId)
      .in("battle_rooms.status", ["waiting", "countdown", "designing", "judging"])
      .maybeSingle();
    if (existingMembership) return { roomId: existingMembership.room_id as string };

    const { data: openRoom } = await admin
      .from("battle_rooms")
      .select("id, battle_room_members(count)")
      .eq("status", "waiting")
      .eq("topic", data.topic)
      .eq("garment", data.garment)
      .limit(1)
      .maybeSingle();

    let roomId = openRoom?.id as string | undefined;
    if (!roomId) {
      const { data: created, error: createErr } = await admin
        .from("battle_rooms")
        .insert({ topic: data.topic, garment: data.garment, max_players: MAX_PLAYERS })
        .select("id")
        .single();
      if (createErr) throw new Error(createErr.message);
      roomId = created.id;
    }

    const { error: joinErr } = await admin
      .from("battle_room_members")
      .insert({ room_id: roomId, user_id: data.userId, username: data.username, level: data.level });
    if (joinErr) throw new Error(joinErr.message);

    const { count } = await admin.from("battle_room_members").select("user_id", { count: "exact", head: true }).eq("room_id", roomId);

    if ((count ?? 0) >= MAX_PLAYERS) {
      const countdownEndsAt = new Date(Date.now() + COUNTDOWN_SECONDS * 1000).toISOString();
      await admin.from("battle_rooms").update({ status: "countdown", countdown_ends_at: countdownEndsAt }).eq("id", roomId);
    }

    return { roomId };
  });

const LeaveInput = z.object({ userId: z.string().uuid(), roomId: z.string().uuid() });

/** Leaving a room that hasn't started designing yet is free (no penalty) —
 *  it just removes your seat so someone else can fill it. Leaving mid-match
 *  is intentionally NOT specially penalized beyond the automatic "0 score"
 *  you'll get for never submitting (see finalizeRoom). */
export const leaveBattleRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LeaveInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { data: room } = await admin.from("battle_rooms").select("status").eq("id", data.roomId).single();
    if (room && room.status === "waiting") {
      await admin.from("battle_room_members").delete().eq("room_id", data.roomId).eq("user_id", data.userId);
    }
    return { ok: true };
  });

const StartDesigningInput = z.object({ roomId: z.string().uuid() });

/** Called by any client in the room once its local countdown reaches 0 —
 *  idempotent (only the first caller actually flips the status, guarded by
 *  `.eq("status", "countdown")`), so it's safe for multiple players'
 *  browsers to call this at roughly the same moment. */
export const startDesigning = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StartDesigningInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const designingEndsAt = new Date(Date.now() + DESIGN_MINUTES * 60_000).toISOString();
    await admin.from("battle_rooms").update({ status: "designing", designing_ends_at: designingEndsAt }).eq("id", data.roomId).eq("status", "countdown");
    return { designingEndsAt };
  });

const SubmitInput = z.object({
  roomId: z.string().uuid(),
  userId: z.string().uuid(),
  garment: z.string(),
  color: z.string(),
  decalUrl: z.string().nullable(),
  decalTransform: z.any().nullable(),
});

export const submitBattleEntry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubmitInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { error } = await admin
      .from("battle_room_members")
      .update({ submitted: true, garment: data.garment, color: data.color, decal_url: data.decalUrl, decal_transform: data.decalTransform })
      .eq("room_id", data.roomId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const FinalizeInput = z.object({ roomId: z.string().uuid() });

/**
 * Judges every submission in the room (AI-scored, same judge model as solo
 * Arena play), ranks them, and applies the win/lose coin stakes. Called by
 * any client once the design timer hits 0 OR everyone has submitted —
 * idempotent via the `.eq("status", ...)` guard so it only actually runs
 * once even if several players' timers fire within moments of each other.
 * Members who never submitted are scored 0 and placed last.
 */
export const finalizeBattleRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => FinalizeInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();

    const { data: claimed } = await admin
      .from("battle_rooms")
      .update({ status: "judging" })
      .eq("id", data.roomId)
      .in("status", ["designing", "countdown"])
      .select("id, topic")
      .maybeSingle();
    if (!claimed) return { ok: true, alreadyFinalized: true };

    const { data: members, error: membersErr } = await admin.from("battle_room_members").select("*").eq("room_id", data.roomId);
    if (membersErr) throw new Error(membersErr.message);

    const key = process.env.LOVABLE_API_KEY;

    const judged = await Promise.all(
      (members ?? []).map(async (m) => {
        if (!m.submitted) return { ...m, score: 0 };
        if (!key) return { ...m, score: 5 }; // graceful fallback if the gateway key is missing — match still resolves
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
            body: JSON.stringify({
              model: "google/gemini-2.5-pro",
              messages: [
                { role: "system", content: `You judge streetwear design battles. Score 0-10 (one decimal) on creativity, color harmony, and how well it fits the topic "${claimed.topic}". Respond ONLY with JSON: {"score": number}.` },
                {
                  role: "user",
                  content: m.decal_url
                    ? [{ type: "text", text: `Garment: ${m.garment}, base color: ${m.color}` }, { type: "image_url", image_url: { url: m.decal_url } }]
                    : `Garment: ${m.garment}, base color: ${m.color}, no artwork uploaded.`,
                },
              ],
              response_format: { type: "json_object" },
            }),
          });
          const json = await res.json();
          const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
          const score = typeof parsed.score === "number" ? Math.max(0, Math.min(10, parsed.score)) : 4;
          return { ...m, score };
        } catch {
          return { ...m, score: 4 };
        }
      }),
    );

    const ranked = [...judged].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Reuse (or create) a real arena_topics row for this battle's topic so
    // submissions can be recorded as normal arena_entries — same table
    // solo Arena play uses, which is what the mission stats
    // (battlesJudged / highScoreEntries in progress.functions.ts) read from.
    let topicId: string | null = null;
    const { data: existingTopic } = await admin.from("arena_topics").select("id").eq("text", claimed.topic).maybeSingle();
    if (existingTopic) {
      topicId = existingTopic.id;
    } else {
      const { data: newTopic } = await admin.from("arena_topics").insert({ text: claimed.topic, author_id: ranked[0]?.user_id ?? null }).select("id").maybeSingle();
      topicId = newTopic?.id ?? null;
    }

    for (let i = 0; i < ranked.length; i++) {
      const placement = i + 1;
      const delta = PLACEMENT_DELTA[placement] ?? 0;
      await admin
        .from("battle_room_members")
        .update({ score: ranked[i].score, placement, rank_points_delta: delta })
        .eq("room_id", data.roomId)
        .eq("user_id", ranked[i].user_id);

      // Apply the coin stake to the player's real profile — clamped at 0 so
      // a bad placement can't push someone's balance negative.
      const { data: profile } = await admin.from("profiles").select("coins").eq("id", ranked[i].user_id).single();
      const newCoins = Math.max(0, (profile?.coins ?? 0) + delta);
      await admin.from("profiles").update({ coins: newCoins }).eq("id", ranked[i].user_id);

      // Real judged submissions also count toward the "score 8.0+" and
      // "battles judged" missions via a normal arena_entries row, same as
      // solo Arena play — keeps one consistent source of truth for stats.
      if (ranked[i].submitted && topicId) {
        const s = ranked[i].score ?? 0;
        await admin.from("arena_entries").insert({
          topic_id: topicId,
          user_id: ranked[i].user_id,
          garment: ranked[i].garment ?? "tee",
          color: ranked[i].color ?? "#ffffff",
          description: `4-player battle room submission (placed #${placement})`,
          score: s,
          creativity: s,
          craft: s,
          topic_fit: s,
          verdict: `Placed #${placement} of ${ranked.length} in a live battle room.`,
        });
      }
    }

    await admin.from("battle_rooms").update({ status: "finished" }).eq("id", data.roomId);

    return { ok: true, alreadyFinalized: false };
  });

const RoomStateInput = z.object({ roomId: z.string().uuid() });

export const getBattleRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RoomStateInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const [{ data: room, error: roomErr }, { data: members, error: membersErr }] = await Promise.all([
      admin.from("battle_rooms").select("*").eq("id", data.roomId).single(),
      admin.from("battle_room_members").select("*").eq("room_id", data.roomId).order("joined_at"),
    ]);
    if (roomErr) throw new Error(roomErr.message);
    if (membersErr) throw new Error(membersErr.message);
    return { room, members };
  });
