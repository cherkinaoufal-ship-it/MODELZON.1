import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type OnlinePlayer = {
  userId: string;
  username: string;
  level: number;
  status: string;
};

/**
 * Tracks real presence in a shared "arena room" using Supabase Realtime —
 * no database table needed, this is live socket state. Every tab running
 * this hook broadcasts who it is and what it's doing (status), and every
 * other tab sees the same live list. Closing the tab / losing connection
 * removes that player automatically (Realtime's presence "leave" event).
 */
export function useArenaPresence(me: { userId: string; username: string; level: number } | null, status: string) {
  const [online, setOnline] = useState<OnlinePlayer[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!me) return;

    const channel = supabase.channel("arena-room", {
      config: { presence: { key: me.userId } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ username: string; level: number; status: string }>();
      const players: OnlinePlayer[] = Object.entries(state).map(([userId, entries]) => {
        const latest = entries[entries.length - 1];
        return { userId, username: latest.username, level: latest.level, status: latest.status };
      });
      setOnline(players);
    });

    channel.subscribe(async (subStatus) => {
      if (subStatus === "SUBSCRIBED") {
        await channel.track({ username: me.username, level: me.level, status });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // Intentionally only re-joins when the person changes, not on every
    // status/level tick — see the effect below for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.userId]);

  // Push status/level changes onto the SAME already-open channel (no re-subscribe).
  useEffect(() => {
    if (!channelRef.current || !me) return;
    channelRef.current.track({ username: me.username, level: me.level, status });
  }, [status, me?.username, me?.level]);

  return online;
}
