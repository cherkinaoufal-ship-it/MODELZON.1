import type { Lang } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, UploadCloud, Video, X } from "lucide-react";
import { uploadShort } from "@/lib/shorts";
import { toast } from "sonner";

/**
 * Shared video-upload UI (§2 of the overhaul brief): the same Reels-style
 * upload experience reachable from BOTH the Reels bottom bar and the new
 * "+" button in the main bottom navigation. Extracted from ShortsFeed so
 * the two stay pixel-identical by construction.
 */

export function VideoUploadDialog({
  lang, userId, username, initialFile, onClose, onDone,
}: {
  lang: Lang;
  userId: string;
  username: string;
  initialFile: File | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [file, setFile] = useState<File | null>(initialFile);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Object URL created exactly once per file (and revoked) — creating it
  // inline in JSX restarts the <video> on every re-render.
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
    <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
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

/** The two-option picker (Reels style): record now vs choose from gallery.
 *  Owns its hidden file inputs; hands the picked file to `onFile`. */
export function VideoUploadPicker({
  lang, open, onClose, onFile,
}: {
  lang: Lang;
  open: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  if (!open) return null;
  return (
    <>
      <input ref={cameraInputRef} type="file" accept="video/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
      <input ref={galleryInputRef} type="file" accept="video/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
      <div className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-xs rounded-t-2xl sm:rounded-2xl bg-black border border-white/10 p-4 pb-8 sm:pb-4">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4 sm:hidden" />
          <p className="text-center text-xs text-white/50 mb-3">{t("Add a video", "أضف فيديو")}</p>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black font-black text-sm mb-2"
          >
            <UploadCloud size={18} /> {t("Upload from device", "رفع فيديو من الجهاز")}
          </button>
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/80 font-bold text-sm"
          >
            <Camera size={18} /> {t("Record now", "تصوير فيديو الآن")}
          </button>
          <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-white/30">
            <ImageIcon size={10} /> {t("Jumps to Reels after posting", "يقفز تلقائياً إلى الريلز بعد النشر")}
          </div>
        </div>
      </div>
    </>
  );
}
