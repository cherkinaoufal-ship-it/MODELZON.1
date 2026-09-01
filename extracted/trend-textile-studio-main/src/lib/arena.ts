import { supabase } from "./supabase";

export type ArenaTopic = {
  id: string;
  text: string;
  author_id: string;
  votes_count: number;
  votedByMe: boolean;
  author_username?: string;
};

export async function listTopics(userId: string): Promise<ArenaTopic[]> {
  const [{ data: topics, error }, { data: myVotes }] = await Promise.all([
    supabase
      .from("arena_topics")
      .select("*, profiles!arena_topics_author_id_fkey(username)")
      .order("votes_count", { ascending: false })
      .limit(30),
    supabase.from("arena_topic_votes").select("topic_id").eq("user_id", userId),
  ]);
  if (error) {
    console.error("Failed to load topics:", error.message);
    return [];
  }
  const votedSet = new Set((myVotes ?? []).map((v) => v.topic_id));
  return (topics ?? []).map((row: any) => ({
    id: row.id,
    text: row.text,
    author_id: row.author_id,
    votes_count: row.votes_count,
    votedByMe: votedSet.has(row.id),
    author_username: row.profiles?.username,
  }));
}

export async function addTopic(text: string, authorId: string): Promise<ArenaTopic | null> {
  const { data, error } = await supabase
    .from("arena_topics")
    .insert({ text, author_id: authorId })
    .select()
    .single();
  if (error) {
    console.error("Failed to add topic:", error.message);
    return null;
  }
  return { ...data, votedByMe: false } as ArenaTopic;
}

export async function voteTopic(topicId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from("arena_topic_votes").insert({ topic_id: topicId, user_id: userId });
  if (error) {
    if (error.code !== "23505") console.error("Failed to vote:", error.message); // 23505 = already voted, ignore quietly
    return false;
  }
  return true;
}

export type ArenaEntry = {
  id: string;
  topic_id: string;
  user_id: string;
  score: number;
  created_at: string;
  username?: string;
};

export async function submitEntry(input: {
  topicId: string;
  userId: string;
  garment: string;
  color: string;
  description: string;
  score: number;
  creativity: number;
  craft: number;
  topicFit: number;
  verdict: string;
}): Promise<ArenaEntry | null> {
  const { data, error } = await supabase
    .from("arena_entries")
    .insert({
      topic_id: input.topicId,
      user_id: input.userId,
      garment: input.garment,
      color: input.color,
      description: input.description,
      score: input.score,
      creativity: input.creativity,
      craft: input.craft,
      topic_fit: input.topicFit,
      verdict: input.verdict,
    })
    .select()
    .single();
  if (error) {
    console.error("Failed to submit entry:", error.message);
    return null;
  }
  return data as ArenaEntry;
}

/** Top scores for one topic — the real, shared battle leaderboard. */
export async function fetchTopicLeaderboard(topicId: string, limit = 10): Promise<ArenaEntry[]> {
  const { data, error } = await supabase
    .from("arena_entries")
    .select("id, topic_id, user_id, score, created_at, profiles!arena_entries_user_id_fkey(username)")
    .eq("topic_id", topicId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Failed to load topic leaderboard:", error.message);
    return [];
  }
  return (data as any[]).map((row) => ({
    id: row.id,
    topic_id: row.topic_id,
    user_id: row.user_id,
    score: row.score,
    created_at: row.created_at,
    username: row.profiles?.username,
  }));
}
