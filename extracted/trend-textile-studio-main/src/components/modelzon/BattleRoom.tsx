import type { Lang } from "@/lib/i18n";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Swords, Mic, MicOff, Send, Trophy, Loader2, LogOut, Timer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { joinBattleRoom, leaveBattleRoom, startDesigning, submitBattleEntry, finalizeBattleRoom, getBattleRoom } from "@/lib/battle.functions";
import { useRoomVoice } from "@/lib/useRoomVoice";
import type { RealtimeChannel } from "@supabase/supabase-js";

type RoomStatus = "waiting" | "countdown" | "designing" | "judging" | "finished";
type Member = { user_id: string; username: string; level: number; submitted: boolean; score: number | null; placement: number | null; rank_points_delta: number | null };
type Room = { id: string; status: RoomStatus; topic: string; garment: string; countdown_ends_at: string | null; designing_ends_at: string | null };
type ChatMsg = { id: number; userId: string; username: string; text: string };

interface Props {
  lang: Lang;
  userId: string;
  username: string;
  level: number;
  topic: string;
  garment: string;
  color: string;
  decalUrl: string | null;
  decalTransform: unknown;
  /** Called the instant the room enters "designing" so the app can jump
   *  the player into the Studio tab automatically. */
  onEnterStudio: () => void;
  onClose: () => void;
}

/**
 * Real 4-player matchmaking: join → short countdown → 10-minute synced
 * design window (with real text chat + best-effort real mic, see
 * useRoomVoice.ts) → AI judges everyone at once → ranked results with real
 * coin stakes (top 2 gain, bottom 2 lose a little). Replaces the previous
 * CompetitorsRoom (just a live "who's online" list, not an actual shared
 * match) and ArenaVoiceChat (hardcoded fake messages, mic toggle that
 * never touched a real microphone).
 */
export default function BattleRoom({ lang, userId, username, level, topic, garment, color, decalUrl, decalTransform, onEnterStudio, onClose }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const joinFn = useServerFn(joinBattleRoom);
  const leaveFn = useServerFn(leaveBattleRoom);
  const startFn = useServerFn(startDesigning);
  const submitFn = useServerFn(submitBattleEntry);
  const finalizeFn = useServerFn(finalizeBattleRoom);
  const getRoomFn = useServerFn(getBattleRoom);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const finalizeCalled = useRef(false);
  const chatChannelRef = useRef<RealtimeChannel | null>(null);
  const { micOn, toggleMic, connectedPeers } = useRoomVoice(room?.status === "designing" ? roomId : null, userId);

  const refresh = useCallback(async (id: string) => {
    const r = await getRoomFn({ data: { roomId: id } });
    setRoom(r.room as Room);
    setMembers(r.members as Member[]);
  }, [getRoomFn]);

  useEffect(() => {
    let cancelled = false;
    joinFn({ data: { userId, username, level, topic, garment } }).then((r) => {
      if (cancelled) return;
      if (!r.roomId) return;
      setRoomId(r.roomId);
      refresh(r.roomId);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`battle-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_rooms", filter: `id=eq.${roomId}` }, () => refresh(roomId))
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_room_members", filter: `room_id=eq.${roomId}` }, () => refresh(roomId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, refresh]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`battle-chat-${roomId}`, { config: { broadcast: { self: true } } });
    chatChannelRef.current = channel;
    channel.on("broadcast", { event: "msg" }, ({ payload }: { payload: ChatMsg }) => setChat((c) => [...c, payload]));
    channel.subscribe();
    return () => { supabase.removeChannel(channel); chatChannelRef.current = null; };
  }, [roomId]);

  const sendChat = () => {
    if (!draft.trim() || !chatChannelRef.current) return;
    chatChannelRef.current.send({ type: "broadcast", event: "msg", payload: { id: Date.now(), userId, username, text: draft.trim() } });
    setDraft("");
  };

  useEffect(() => {
    if (!room) return;
    const target = room.status === "countdown" ? room.countdown_ends_at : room.status === "designing" ? room.designing_ends_at : null;
    if (!target) { setSecondsLeft(null); return; }

    const tick = () => {
      const left = Math.max(0, Math.round((new Date(target).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && roomId) {
        if (room.status === "countdown") { startFn({ data: { roomId } }); onEnterStudio(); }
        else if (room.status === "designing" && !finalizeCalled.current) { finalizeCalled.current = true; finalizeFn({ data: { roomId } }); }
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.countdown_ends_at, room?.designing_ends_at, roomId]);

  useEffect(() => { if (room?.status === "designing") onEnterStudio(); }, [room?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!roomId || submitted) return;
    await submitFn({ data: { roomId, userId, garment, color, decalUrl, decalTransform } });
    setSubmitted(true);
  };

  const handleLeave = async () => {
    if (roomId) await leaveFn({ data: { userId, roomId } });
    onClose();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!room) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-300" size={28} />
      </div>
    );
  }

  if (room.status === "waiting" || room.status === "countdown") {
    return (
      <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-cyan-400/30 bg-[#000000] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-cyan-300 font-black">
              <Swords size={18} /> {t("Matchmaking", "بحث عن منافسين")}
            </div>
            <button onClick={handleLeave} className="text-white/40 hover:text-red-300"><LogOut size={16} /></button>
          </div>

          {room.status === "waiting" ? (
            <>
              <p className="text-xs text-white/50 mb-3">{t("Waiting for 4 players to fill this room...", "بانتظار اكتمال الغرفة بـ 4 لاعبين...")}</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {Array.from({ length: 4 }).map((_, i) => {
                  const m = members[i];
                  return (
                    <div key={i} className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 ${m ? "border-cyan-400/50 bg-cyan-500/10" : "border-white/10 bg-white/[0.02] border-dashed"}`}>
                      {m ? (
                        <>
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-black font-black text-xs">{m.username[0]?.toUpperCase()}</div>
                          <span className="text-[9px] text-white/70 truncate max-w-full px-1">{m.username}</span>
                        </>
                      ) : (
                        <Loader2 size={16} className="text-white/20 animate-spin" />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="animate-pulse text-center text-[11px] text-cyan-300">{t("Searching for real opponents...", "نبحث لك عن منافسين حقيقيين...")}</div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-6xl font-black text-cyan-300 tabular-nums">{secondsLeft ?? "…"}</div>
              <p className="text-sm text-white/60 mt-2">{t("Get ready! Battle starts in...", "استعد! المعركة تبدأ خلال...")}</p>
              <div className="flex justify-center -space-x-2 mt-4">
                {members.map((m) => (
                  <div key={m.user_id} className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 border-2 border-black flex items-center justify-center text-black font-black text-xs" title={m.username}>
                    {m.username[0]?.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (room.status === "judging") {
    return (
      <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="animate-spin text-cyan-300 mx-auto mb-3" size={32} />
          <p className="text-white/70 text-sm">{t("The AI is judging everyone's design...", "الذكاء الاصطناعي يحكم على تصاميم الجميع...")}</p>
        </div>
      </div>
    );
  }

  if (room.status === "finished") {
    const ranked = [...members].sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9));
    return (
      <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#000000] p-5">
          <div className="flex items-center gap-2 text-amber-300 font-black mb-4">
            <Trophy size={18} /> {t("Battle Results", "نتيجة المعركة")}
          </div>
          <div className="space-y-2">
            {ranked.map((m) => (
              <div key={m.user_id} className={`rounded-xl p-3 flex items-center justify-between border ${
                m.placement === 1 ? "border-amber-400/60 bg-amber-500/10" : m.placement === 2 ? "border-cyan-400/40 bg-cyan-500/5" : "border-white/10 bg-white/[0.02]"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black w-6 text-center">{m.placement === 1 ? "🥇" : m.placement === 2 ? "🥈" : m.placement === 3 ? "🥉" : "4️⃣"}</span>
                  <div>
                    <div className="text-sm font-bold">{m.username}{m.user_id === userId && ` (${t("You", "أنت")})`}</div>
                    <div className="text-[10px] text-white/40">{t("Score", "التقييم")} {(m.score ?? 0).toFixed(1)}/10</div>
                  </div>
                </div>
                <span className={`text-sm font-black font-mono ${(m.rank_points_delta ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {(m.rank_points_delta ?? 0) >= 0 ? "+" : ""}{m.rank_points_delta ?? 0}
                </span>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="mt-4 w-full py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 font-bold text-sm">
            {t("Continue", "متابعة")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 lg:bottom-4 left-4 z-[55] w-72">
      <div className="rounded-2xl border border-cyan-400/30 bg-[#000000]/95 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.15)] overflow-hidden">
        <div className="p-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-black">
            <Timer size={13} /> {secondsLeft !== null ? fmt(secondsLeft) : "…"}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleMic} title={t("Toggle mic", "الميكروفون")} className={`p-1.5 rounded-lg ${micOn ? "bg-cyan-500/20 text-cyan-300" : "bg-white/5 text-white/40"}`}>
              {micOn ? <Mic size={13} /> : <MicOff size={13} />}
            </button>
            <button onClick={() => setChatOpen((o) => !o)} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-white/60">{t("Chat", "دردشة")}</button>
          </div>
        </div>

        <div className="px-3 py-1.5 text-[10px] text-white/40 flex items-center gap-1">
          <Users size={10} /> {members.length} {t("in match", "بالمعركة")} · {connectedPeers.length} {t("voice connected", "متصلين صوتياً")}
        </div>

        <AnimatePresence>
          {chatOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: 200 }} exit={{ height: 0 }} className="overflow-hidden border-t border-white/10">
              <div className="h-[160px] overflow-y-auto p-2 space-y-1">
                {chat.map((m) => (
                  <div key={m.id} className="text-[11px]"><span className="text-cyan-300 font-bold">{m.username}: </span><span className="text-white/70">{m.text}</span></div>
                ))}
              </div>
              <div className="flex gap-1 p-2 border-t border-white/10">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder={t("Message...", "رسالة...")} className="flex-1 bg-black/40 rounded-lg px-2 py-1 text-[11px] outline-none border border-white/10" />
                <button onClick={sendChat}><Send size={13} className="text-cyan-300" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleSubmit}
          disabled={submitted}
          className="w-full py-2.5 text-xs font-black bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black disabled:opacity-50"
        >
          {submitted ? t("✓ Submitted — waiting for others", "✓ تم التسليم — بانتظار الباقين") : t("Submit My Design", "سلّم تصميمي")}
        </button>
      </div>
    </div>
  );
}
