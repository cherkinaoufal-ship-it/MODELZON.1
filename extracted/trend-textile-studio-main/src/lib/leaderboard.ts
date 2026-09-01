import { supabase } from "./supabase";

export type LeaderboardEntry = {
  id: string;
  username: string;
  level: number;
  xp: number;
  score: number;
};

/**
 * Real cross-player ranking, pulled live from the profiles table (RLS lets
 * any signed-in user read everyone's level/xp/score, but only ever write
 * their own row — see 001_profiles.sql). Ordered by level then XP, which is
 * the same progression the individual rank cards already use.
 */
export async function fetchTopPlayers(limit = 10): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, level, xp, score")
    .order("level", { ascending: false })
    .order("xp", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Failed to load leaderboard:", error.message);
    return [];
  }
  return data as LeaderboardEntry[];
}
