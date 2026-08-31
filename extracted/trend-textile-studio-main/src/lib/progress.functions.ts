import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Server-authoritative missions, XP, level & coins.
 *
 * Replaces the old model (pure React state, `grantXP(amount, label)` called
 * for literally every click — changing a color, picking a size — and never
 * once written to the database). Now: XP is only ever granted by the
 * server, only for completing one of the missions below, and only after
 * independently re-counting the real underlying data (designs actually
 * saved, arena entries actually judged, sales actually paid) — never by
 * trusting a client-supplied amount. See 013_missions_progress.sql for the
 * column-level protection this relies on.
 */

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key);
}

const XP_PER_LEVEL = 1000;

export type Stats = {
  designsSaved: number;
  battlesJudged: number;
  highScoreEntries: number; // arena entries scored 8.0+
  listedForSale: number;
  paidSales: number;
};

export interface Mission {
  id: string;
  titleEn: string;
  titleAr: string;
  xp: number;
  coins: number;
  /** Minimum player level this mission is even offered at — keeps early
   *  ranks from being flooded with marketplace/sales missions nobody at
   *  that level can attempt yet (listing requires level 50, see
   *  003_marketplace.sql). */
  minLevel: number;
  check: (s: Stats) => boolean;
}

/** The full mission catalog — ordered roughly by when a player will hit
 *  them. Add new missions here; nothing else needs to change, `syncMissions`
 *  re-evaluates this whole list against real stats every time it's called. */
export const MISSIONS: Mission[] = [
  { id: "first_design", titleEn: "Save your first design", titleAr: "احفظ أول تصميم لك", xp: 50, coins: 15, minLevel: 1, check: (s) => s.designsSaved >= 1 },
  { id: "five_designs", titleEn: "Save 5 designs", titleAr: "احفظ 5 تصاميم", xp: 150, coins: 40, minLevel: 1, check: (s) => s.designsSaved >= 5 },
  { id: "twenty_designs", titleEn: "Save 20 designs", titleAr: "احفظ 20 تصميم", xp: 400, coins: 100, minLevel: 1, check: (s) => s.designsSaved >= 20 },
  { id: "first_battle", titleEn: "Enter your first Arena battle", titleAr: "ادخل أول معركة بالساحة", xp: 60, coins: 20, minLevel: 1, check: (s) => s.battlesJudged >= 1 },
  { id: "ten_battles", titleEn: "Judge 10 Arena submissions", titleAr: "شارك بـ10 معارك بالساحة", xp: 300, coins: 80, minLevel: 1, check: (s) => s.battlesJudged >= 10 },
  { id: "first_high_score", titleEn: "Score 8.0+ in a battle", titleAr: "احصل على تقييم 8.0+ بمعركة", xp: 200, coins: 60, minLevel: 1, check: (s) => s.highScoreEntries >= 1 },
  { id: "five_high_scores", titleEn: "Score 8.0+ five times", titleAr: "احصل على تقييم 8.0+ خمس مرات", xp: 500, coins: 150, minLevel: 1, check: (s) => s.highScoreEntries >= 5 },
  { id: "first_listing", titleEn: "List a design on the marketplace", titleAr: "اعرض تصميم بالسوق", xp: 250, coins: 80, minLevel: 50, check: (s) => s.listedForSale >= 1 },
  { id: "first_sale", titleEn: "Make your first sale", titleAr: "حقق أول عملية بيع", xp: 400, coins: 150, minLevel: 50, check: (s) => s.paidSales >= 1 },
  { id: "five_sales", titleEn: "Make 5 sales", titleAr: "حقق 5 عمليات بيع", xp: 800, coins: 300, minLevel: 50, check: (s) => s.paidSales >= 5 },
];

async function computeStats(admin: ReturnType<typeof adminClient>, userId: string): Promise<Stats> {
  const [designs, entries, highScores, listed, sales] = await Promise.all([
    admin.from("designs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("arena_entries").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("arena_entries").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("score", 8),
    admin.from("designs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("for_sale", true),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", userId).eq("status", "paid"),
  ]);
  return {
    designsSaved: designs.count ?? 0,
    battlesJudged: entries.count ?? 0,
    highScoreEntries: highScores.count ?? 0,
    listedForSale: listed.count ?? 0,
    paidSales: sales.count ?? 0,
  };
}

const SyncInput = z.object({ userId: z.string().uuid() });

/**
 * Call this after any action that might complete a mission (saving a
 * design, finishing an Arena judge call, listing for sale). Idempotent and
 * safe to call often — missions already in `completed_missions` are never
 * re-granted, and everything else is freshly recomputed from real data.
 */
export const syncMissions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SyncInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("level, xp, coins, completed_missions")
      .eq("id", data.userId)
      .single();
    if (profileErr || !profile) throw new Error(profileErr?.message ?? "Profile not found");

    const stats = await computeStats(admin, data.userId);
    const already = new Set<string>(profile.completed_missions ?? []);
    const newlyCompleted: Mission[] = [];
    let xp = profile.xp;
    let coins = profile.coins;

    for (const m of MISSIONS) {
      if (already.has(m.id)) continue;
      if (!m.check(stats)) continue;
      already.add(m.id);
      xp += m.xp;
      coins += m.coins;
      newlyCompleted.push(m);
    }

    const level = 1 + Math.floor(xp / XP_PER_LEVEL);

    if (newlyCompleted.length > 0 || level !== profile.level) {
      const { error: updateErr } = await admin
        .from("profiles")
        .update({ xp, coins, level, missions: already.size, completed_missions: Array.from(already) })
        .eq("id", data.userId);
      if (updateErr) throw new Error(updateErr.message);
    }

    return {
      xp,
      level,
      coins,
      xpIntoLevel: xp % XP_PER_LEVEL,
      xpPerLevel: XP_PER_LEVEL,
      newlyCompleted: newlyCompleted.map((m) => ({ id: m.id, titleEn: m.titleEn, titleAr: m.titleAr, xp: m.xp, coins: m.coins })),
      stats,
    };
  });

/** Read-only fetch for the Ranks/Profile screens — same computation as
 *  syncMissions but never writes anything, so it's safe to call on every
 *  render without granting XP twice or racing a concurrent sync. */
export const getProgress = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SyncInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("level, xp, coins, completed_missions")
      .eq("id", data.userId)
      .single();
    if (error || !profile) throw new Error(error?.message ?? "Profile not found");
    const stats = await computeStats(admin, data.userId);
    return {
      xp: profile.xp,
      level: profile.level,
      coins: profile.coins,
      xpIntoLevel: profile.xp % XP_PER_LEVEL,
      xpPerLevel: XP_PER_LEVEL,
      completedMissionIds: profile.completed_missions ?? [],
      stats,
    };
  });
