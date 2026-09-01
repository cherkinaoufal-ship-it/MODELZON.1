import type { Lang } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles, Plus, ArrowBigUp, Gavel, Loader2, Wand2, ToggleLeft, ToggleRight, Users, Trophy, ImageUp,
} from "lucide-react";
import { judgeDesign, generateChallenge } from "@/lib/arena-ai.functions";
import { listTopics, addTopic as addTopicDb, voteTopic, submitEntry, fetchTopicLeaderboard, type ArenaTopic, type ArenaEntry } from "@/lib/arena";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  lang: Lang;
  garment: string;
  color: string;
  topic: string;
  decalUrl: string | null;
  /** Captures the real, current 3D render (shape + color + both decals +
   *  freehand paint) right before judging, so the AI evaluates what the
   *  garment actually looks like instead of only the flat decal image.
   *  Falls back to `decalUrl` if this is missing or returns null (e.g.
   *  canvas not mounted yet). */
  getGarmentSnapshot?: () => string | null;
  onTopic: (text: string) => void;
  onScore: (score: number) => void;
  /** Called only when the new submission ranks in the current topic's top 2. */
  onTopRank?: (rank: 1 | 2) => void;
}

type Judgement = Awaited<ReturnType<typeof judgeDesign>>;
type Challenge = Awaited<ReturnType<typeof generateChallenge>>;

export default function ArenaBoard({ lang, garment, color, topic, decalUrl, getGarmentSnapshot, onTopic, onScore, onTopRank }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const judge = useServerFn(judgeDesign);
  const challengeFn = useServerFn(generateChallenge);
  const { user } = useAuth();

  const [topics, setTopics] = useState<ArenaTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [draft, setDraft] = useState("");

  const [aiChallengeOn, setAiChallengeOn] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeBusy, setChallengeBusy] = useState(false);

  const [description, setDescription] = useState("");
  const [section, setSection] = useState<"topics" | "challenge" | "judge">("topics");
  const [uploadedJudgeImage, setUploadedJudgeImage] = useState<string | null>(null);
  const [result, setResult] = useState<Judgement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [topicLeaderboard, setTopicLeaderboard] = useState<ArenaEntry[]>([]);

  const currentTopicId = topics.find((x) => x.text === topic)?.id ?? null;

  const loadTopics = async () => {
    if (!user) return;
    setTopicsLoading(true);
    const rows = await listTopics(user.id);
    setTopics(rows);
    setTopicsLoading(false);
  };

  useEffect(() => {
    loadTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!currentTopicId) {
      setTopicLeaderboard([]);
      return;
    }
    fetchTopicLeaderboard(currentTopicId).then(setTopicLeaderboard);
  }, [currentTopicId]);

  const addTopic = async () => {
    const text = draft.trim();
    if (!text || !user) return;
    const created = await addTopicDb(text, user.id);
    if (created) {
      setDraft("");
      onTopic(text);
      loadTopics();
    } else {
      toast.error(t("Couldn't add topic", "تعذّر إضافة الموضوع"));
    }
  };

  const vote = async (id: string) => {
    if (!user) return;
    setTopics((prev) => prev.map((x) => (x.id === id ? { ...x, votes_count: x.votes_count + 1, votedByMe: true } : x)));
    const ok = await voteTopic(id, user.id);
    if (!ok) loadTopics(); // revert the optimistic update by re-syncing with the server
  };


  const runChallenge = async () => {
    if (!user) return;
    setChallengeBusy(true);
    setError(null);
    try {
      setChallenge(await challengeFn({ data: { userId: user.id, lang, garment } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChallengeBusy(false);
    }
  };

  const runJudge = async () => {
    if (!description.trim() || !user) return;
    setBusy(true);
    setError(null);
    try {
      const r = await judge({ data: { userId: user.id, lang, garment, color, topic, description, decalImage: uploadedJudgeImage ?? getGarmentSnapshot?.() ?? decalUrl } });
      setResult(r);
      onScore(r.score);

      if (currentTopicId) {
        const entry = await submitEntry({
          topicId: currentTopicId,
          userId: user.id,
          garment,
          color,
          description,
          score: r.score,
          creativity: r.creativity,
          craft: r.craft,
          topicFit: r.topicFit,
          verdict: r.verdict,
        });
        if (entry) {
          const board = await fetchTopicLeaderboard(currentTopicId);
          setTopicLeaderboard(board);
          const rank = board.findIndex((e) => e.id === entry.id);
          if (rank === 0 || rank === 1) {
            onTopRank?.((rank + 1) as 1 | 2);
            toast.success(
              lang === "ar"
                ? `🏆 أنت بالمركز ${rank + 1} بهالموضوع! خبرة إضافية`
                : `🏆 You're #${rank + 1} on this topic! Bonus XP`,
            );
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };



  return (
    <div className="space-y-4">
      {/* Icon sub-tabs instead of three long cards stacked on top of each
          other — pick what you're here for. */}
      <div className="flex rounded-xl border border-white/10 overflow-hidden text-[11px] font-bold">
        {([
          ["topics", Users, t("Topics", "المواضيع")],
          ["challenge", Wand2, t("AI Challenge", "تحدي الذكاء الاصطناعي")],
          ["judge", Gavel, t("Judge Me", "قيّمني")],
        ] as const).map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition ${
              section === id ? "bg-cyan-500/20 text-cyan-100" : "bg-white/[0.02] text-white/50 hover:bg-white/[0.05]"
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Community topics — people decide, not the AI */}
      {section === "topics" && (
      <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <Users size={15} className="text-cyan-300" />
          <span className="text-sm font-black">{t("Community topics", "مواضيع الناس")}</span>
          <span className="ml-auto text-[10px] text-white/40">
            {t("Voted by players", "بتصويت اللاعبين")}
          </span>
        </div>
        <p className="text-[11px] text-white/50 mb-3">
          {t("Players suggest and vote on what the arena designs. The AI never chooses the topic.", "اللاعبون يقترحون ويصوّتون على موضوع الساحة. الذكاء الاصطناعي لا يحدد الموضوع أبداً.")}
        </p>

        <div className="flex gap-2 mb-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTopic()}
            placeholder={t("Suggest a topic…", "اقترح موضوعاً…")}
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50"
          />
          <button
            onClick={addTopic}
            className="px-3 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center gap-1"
          >
            <Plus size={13} /> {t("Add", "إضافة")}
          </button>
        </div>

        <div className="space-y-2">
          {topicsLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-white/40" size={18} /></div>
          ) : (
            topics.map((x) => {
              const active = topic === x.text;
              return (
                <div
                  key={x.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition ${
                    active ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-black/30"
                  }`}
                >
                  <button onClick={() => onTopic(x.text)} className="flex-1 text-start">
                    <div className="text-xs font-bold leading-tight">{x.text}</div>
                    <div className="text-[10px] text-white/40">{x.author_username ?? "Player"}</div>
                  </button>
                  <button
                    onClick={() => vote(x.id)}
                    disabled={x.votedByMe}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border ${
                      x.votedByMe
                        ? "bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-200"
                        : "bg-white/5 border-white/10 text-white/60"
                    }`}
                  >
                    <ArrowBigUp size={13} /> {x.votes_count}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {section === "topics" && currentTopicId && topicLeaderboard.length > 0 && (
        <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={14} className="text-yellow-400" />
            <span className="text-sm font-black">{t("Topic Leaderboard", "متصدرو الموضوع")}</span>
          </div>
          <div className="space-y-1.5">
            {topicLeaderboard.map((e, i) => (
              <div key={e.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${i < 2 ? "bg-amber-500/10 border border-amber-400/30" : "bg-white/[0.02]"}`}>
                <span className="w-4 text-center font-mono text-white/40">{i + 1}</span>
                <span className="flex-1 truncate">{e.username ?? "Player"}</span>
                <span className="font-mono text-cyan-300">{e.score.toFixed(1)}</span>
                {i < 2 && <span>🏆</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional AI challenge */}
      {section === "challenge" && (
      <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
        <button
          onClick={() => setAiChallengeOn((v) => !v)}
          className="w-full flex items-center gap-2"
        >
          <Wand2 size={15} className="text-fuchsia-300" />
          <span className="text-sm font-black">{t("AI design challenge", "تحدي الذكاء الاصطناعي")}</span>
          {aiChallengeOn ? (
            <ToggleRight size={26} className="ml-auto text-cyan-300" />
          ) : (
            <ToggleLeft size={26} className="ml-auto text-white/30" />
          )}
        </button>
        <p className="text-[11px] text-white/50 mt-1">
          {t("Optional. When on, the AI gives you a reference design and you must recreate it by hand.", "اختياري. عند تشغيله يعطيك الذكاء الاصطناعي تصميماً مرجعياً وعليك رسمه بيدك مثله.")}
        </p>

        <AnimatePresence>
          {aiChallengeOn && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <button
                onClick={runChallenge}
                disabled={challengeBusy}
                className="mt-3 px-3 py-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-100 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {challengeBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {t("Generate challenge", "توليد تحدٍ")}
              </button>

              {challenge && (
                <div className="mt-3 rounded-xl p-3 bg-black/40 border border-white/10">
                  <div className="font-black text-sm">{challenge.title}</div>
                  <p className="text-[11px] text-white/60 mt-1 leading-relaxed">{challenge.brief}</p>
                  <ol className="mt-2 space-y-1">
                    {challenge.steps.map((s, i) => (
                      <li key={i} className="text-[11px] text-white/70 flex gap-2">
                        <span className="text-cyan-300 font-mono">{i + 1}.</span> {s}
                      </li>
                    ))}
                  </ol>
                  <div className="flex gap-2 mt-2">
                    {challenge.colors.map((c) => (
                      <span key={c} className="w-6 h-6 rounded-md border border-white/20" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* AI judging of the player's own hand-made design */}
      {section === "judge" && (
      <div className="rounded-2xl p-4 bg-gradient-to-br from-cyan-950/40 to-fuchsia-950/30 border border-cyan-500/25">
        <div className="flex items-center gap-2 mb-1">
          <Gavel size={15} className="text-cyan-300" />
          <span className="text-sm font-black">{t("AI judge", "تقييم الذكاء الاصطناعي")}</span>
        </div>
        <p className="text-[11px] text-white/50 mb-3">
          {t("Describe the design you drew and let the judge score it against the community topic.", "اوصف التصميم الذي رسمته ودع الحكم يقيّمه مقابل موضوع الناس.")}
        </p>
        {decalUrl ? (
          <div className="mb-3 flex items-center gap-2 text-[10px] text-emerald-300">
            <img src={decalUrl} alt="" className="w-8 h-8 rounded object-contain bg-black/40 border border-emerald-400/30" />
            {t("The judge will look at this artwork directly, not just your text.", "الحكم بيشوف هالرسمة مباشرة، مب بس النص اللي تكتبه.")}
          </div>
        ) : (
          <p className="text-[10px] text-amber-300/80 mb-3">
            {t("No artwork on the garment yet — the judge will score from your description only. Draw or upload one in the Studio for a fairer score.", "ما فيه رسمة على القطعة بعد — الحكم بيقيّم من وصفك النصي بس. ارسم أو ارفع صورة بالاستوديو لتقييم أدق.")}
          </p>
        )}

        {/* Upload a design image directly to be judged — separate from the
            automatic Studio snapshot, for a photo, a screenshot, or artwork
            made outside MODELZON entirely. Takes priority over the Studio
            snapshot when set. */}
        <div className="mb-3 flex items-center gap-2">
          {uploadedJudgeImage ? (
            <div className="relative">
              <img src={uploadedJudgeImage} alt="" className="w-14 h-14 rounded-lg object-cover border border-cyan-400/40" />
              <button onClick={() => setUploadedJudgeImage(null)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">✕</button>
            </div>
          ) : (
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/60 cursor-pointer hover:bg-white/10">
              <ImageUp size={13} />
              {t("Upload a design image to judge", "ارفع صورة تصميم للحكم عليها")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setUploadedJudgeImage(reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          )}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={t("e.g. black hoodie, gold Arabic calligraphy on the chest, frayed stitching on the sleeves…", "مثال: هودي أسود، خط عربي ذهبي على الصدر، خيوط منسّلة على الأكمام…")}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50 resize-none"
        />
        <button
          onClick={runJudge}
          disabled={busy || !description.trim()}
          className="mt-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-xs font-bold flex items-center gap-2 disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Gavel size={13} />}
          {t("Score my design", "قيّم تصميمي")}
        </button>

        {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl p-3 bg-black/40 border border-white/10">
            <div className="text-3xl font-black text-cyan-300">{result.score.toFixed(1)}<span className="text-sm text-white/40">/10</span></div>
            <div className="text-[11px] text-white/70 mt-1">{result.verdict}</div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { l: t("Creativity", "الإبداع"), v: result.creativity },
                { l: t("Craft", "التنفيذ"), v: result.craft },
                { l: t("Topic fit", "مطابقة الموضوع"), v: result.topicFit },
              ].map((m) => (
                <div key={m.l} className="rounded-lg p-2 bg-white/[0.04] border border-white/10 text-center">
                  <div className="text-base font-black text-fuchsia-200">{m.v}</div>
                  <div className="text-[9px] text-white/40 uppercase leading-tight">{m.l}</div>
                </div>
              ))}
            </div>
            {result.strengths.length > 0 && (
              <ul className="mt-3 space-y-1">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-[11px] text-emerald-300/90">+ {s}</li>
                ))}
              </ul>
            )}
            {result.improve.length > 0 && (
              <ul className="mt-1 space-y-1">
                {result.improve.map((s, i) => (
                  <li key={i} className="text-[11px] text-amber-300/90">→ {s}</li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </div>
      )}
    </div>
  );
}
