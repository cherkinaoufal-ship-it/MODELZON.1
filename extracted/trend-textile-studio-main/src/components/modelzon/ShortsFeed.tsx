import type { Lang } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, UploadCloud, Video, X, Loader2, Camera, Play, Volume2, VolumeX } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { fetchShorts, uploadShort, toggleShortLike, fetchMyLikedShortIds, type ShortVideo } from "@/lib/shorts";
import { toast } from "sonner";

/**
 * Real video feed — replaces the previous fully-mocked version (hardcoded
 * spinning 3D placeholder objects, fake authors/likes, no actual upload
 * capability at all). Any video file, no MODELZON-imposed size limit (see
 * the `shorts-videos` bucket in 016_shorts.sql for the real ceiling).
 */
export default function ShortsFeed({ lang }: { lang: Lang }) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const { user, profile } = useAuth();
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setShorts(await fetchShorts());
    if (user) setLiked(await fetchMyLikedShortIds(user.id));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLike = async (s: ShortVideo) => {
    if (!user) return;
    const isLiked = liked.has(s.id);
    const ok = await toggleShortLike(s.id, user.id, isLiked);
    if (!ok) return;
    setLiked((prev) => { const next = new Set(prev); isLiked ? next.delete(s.id) : next.add(s.id); return next; });
    setShorts((prev) => prev.map((x) => (x.id === s.id ? { ...x, likes_count: x.likes_count + (isLiked ? -1 : 1) } : x)));
  };

  return (
    /* Full-screen vertical reels surface (TikTok / IG Reels style): one video
       per viewport page, snap scrolling, overlay UI on top of the video. The
       bottom nav (z-40) stays tappable above this layer. */
    <div className="fixed inset-0 z-30 bg-black">
      <input ref={cameraInputRef} type="file" accept="video/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setUploadOpen(true); } e.currentTarget.value = ""; }} />
      <input ref={galleryInputRef} type="file" accept="video/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setUploadOpen(true); } e.currentTarget.value = ""; }} />

      {loading ? (
        <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-white/40" size={26} /></div>
      ) : shorts.length === 0 ? (
        <div className="flex h-full items-center justify-center px-8">
          <p className="text-sm text-white/50 text-center">
            {t("No videos yet — be the first to upload one!", "ما فيه فيديوهات بعد — كن أول واحد يرفع!")}
          </p>
        </div>
      ) : (
        <div className="h-full overflow-y-auto snap-y snap-mandatory overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shorts.map((s) => (
            <ReelPage
              key={s.id}
              short={s}
              lang={lang}
              isLiked={liked.has(s.id)}
              onLike={() => handleLike(s)}
            />
          ))}
        </div>
      )}


      {uploadOpen && user && (
        <UploadDialog
          lang={lang}
          userId={user.id}
          username={profile?.username || "Player"}
          initialFile={pendingFile}
          onClose={() => { setUploadOpen(false); setPendingFile(null); }}
          onDone={() => { setUploadOpen(false); setPendingFile(null); void load(); }}
        />
      )}

      {/* Bottom action bar (by request: the upload control moved from a
          floating corner button into a proper bottom bar). Two direct
          actions — record now, or pick from the gallery. Sits above the
          app's own bottom nav on mobile, and floats at the bottom edge on
          desktop where there is no nav. */}
      <div className="absolute inset-x-0 bottom-[66px] lg:bottom-5 z-40 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/75 backdrop-blur-xl border border-white/15 pl-1.5 pr-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-black text-white/85 hover:text-white hover:bg-white/10 transition"
          >
            <Camera size={16} />
            <span className="hidden xs:inline sm:inline">{t("تصوير", "Record")}</span>
          </button>
          <span className="w-px h-6 bg-white/15" />
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black text-black bg-gradient-to-r from-cyan-400 to-fuchsia-500 hover:brightness-110 active:scale-95 transition"
          >
            <UploadCloud size={16} />
            {t("رفع فيديو", "Upload video")}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadDialog({ lang, userId, username, initialFile, onClose, onDone }: { lang: Lang; userId: string; username: string; initialFile: File | null; onClose: () => void; onDone: () => void }) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [file, setFile] = useState<File | null>(initialFile);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Bug fix: this used to call `URL.createObjectURL(file)` directly inside
  // the JSX, which creates a BRAND NEW blob URL on every single re-render
  // (including just typing in the caption box) — the <video> element kept
  // getting handed a different src and restarting, which is exactly the
  // "stuck spinning, never actually plays" glitch. Now the object URL is
  // created exactly once per file (and cleaned up when it changes/unmounts).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    const result = await uploadShort({ userId, username, file, caption, garment: null, onProgress: setProgress });
    setBusy(false);
    if (result.ok) { toast.success(t("Video uploaded 🎬", "تم رفع الفيديو 🎬")); onDone(); }
    else toast.error(result.message ?? t("Upload failed", "فشل الرفع"));
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="w-full max-w-sm rounded-2xl border border-cyan-400/30 bg-black p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-cyan-300 font-black text-sm"><Video size={16} /> {t("Upload video", "رفع فيديو")}</div>
          {!busy && <button onClick={onClose}><X size={18} className="text-white/40" /></button>}
        </div>

        {!file ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full aspect-video rounded-xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-2 text-white/40 hover:border-cyan-400/40 hover:text-cyan-300 transition"
          >
            <UploadCloud size={28} />
            <span className="text-xs">{t("Tap to choose any video — no size limit", "اضغط لاختيار أي فيديو — بدون حد للحجم")}</span>
          </button>
        ) : (
          <div className="rounded-xl overflow-hidden bg-black border border-white/10">
            {previewUrl && <video src={previewUrl} controls playsInline className="w-full max-h-56" />}
          </div>
        )}
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t("Caption (optional)", "وصف (اختياري)")}
          rows={2}
          className="w-full mt-3 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50 resize-none"
        />

        {progress !== null && (
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button
          onClick={submit}
          disabled={!file || busy}
          className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          {busy ? `${progress ?? 0}%` : t("Post", "نشر")}
        </button>
      </div>
    </div>
  );
}

/** One full-viewport reel page: autoplays while it's the visible page,
 *  pauses when scrolled away, tap anywhere to pause/resume. */
function ReelPage({ short, lang, isLiked, onLike }: { short: ShortVideo; lang: Lang; isLiked: boolean; onLike: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          void el.play().catch(() => {});
          setPaused(false);
        } else {
          el.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) { void el.play().catch(() => {}); setPaused(false); }
    else { el.pause(); setPaused(true); }
  };

  return (
    <section className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={short.video_url}
        playsInline
        loop
        muted={muted}
        preload="metadata"
        onClick={toggle}
        className="absolute inset-0 h-full w-full object-contain"
      />

      {paused && (
        <button onClick={toggle} className="absolute inset-0 flex items-center justify-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-black/50 backdrop-blur-sm">
            <Play size={28} className="text-white" fill="white" />
          </span>
        </button>
      )}

      {/* right-side action rail */}
      <div className="absolute bottom-40 right-3 flex flex-col items-center gap-5">
        <button onClick={onLike} className="flex flex-col items-center gap-1 text-white">
          <Heart size={28} fill={isLiked ? "#ec4899" : "none"} color={isLiked ? "#ec4899" : "white"} />
          <span className="text-[11px] font-bold">{short.likes_count.toLocaleString()}</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-white/90">
          <MessageCircle size={26} />
          <span className="text-[11px] font-bold">0</span>
        </button>
        <button
          onClick={() => { void navigator.clipboard?.writeText(short.video_url); toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied"); }}
          className="text-white/90"
        >
          <Share2 size={24} />
        </button>
        <button onClick={() => setMuted((m) => !m)} className="text-white/90">
          {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </button>
      </div>

      {/* bottom meta, above the bottom action bar + app nav */}
      <div className="absolute inset-x-0 bottom-36 lg:bottom-24 px-4 pr-16 bg-gradient-to-t from-black/80 to-transparent pt-10 pb-2">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-[12px] font-black text-black">
            {short.username[0]?.toUpperCase()}
          </div>
          <span className="min-w-0 truncate text-sm font-black text-white">@{short.username}</span>
          {short.garment && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-white/70">{short.garment}</span>
          )}
        </div>
        {short.caption && <p className="mt-2 text-[13px] leading-snug text-white/85">{short.caption}</p>}
      </div>
    </section>
  );
}
