import type { Lang } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, UploadCloud, Video, X, Loader2, Camera, Play, Volume2, VolumeX } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { fetchShorts, toggleShortLike, fetchMyLikedShortIds, type ShortVideo } from "@/lib/shorts";
import { VideoUploadDialog } from "@/components/modelzon/VideoUpload";
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
        <VideoUploadDialog
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
            <span className="hidden xs:inline sm:inline">{t("Record", "تصوير")}</span>
          </button>
          <span className="w-px h-6 bg-white/15" />
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black text-black bg-gradient-to-r from-cyan-400 to-fuchsia-500 hover:brightness-110 active:scale-95 transition"
          >
            <UploadCloud size={16} />
            {t("Upload video", "رفع فيديو")}
          </button>
        </div>
      </div>
    </div>
  );
}

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
