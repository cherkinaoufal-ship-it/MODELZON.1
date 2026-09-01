import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { GARMENT_PARTS, PART_CATEGORIES, type GarmentPartCategory } from "@/lib/garmentPartsLibrary";
import { FABRIC_EFFECTS } from "@/lib/fabricEffects";

/**
 * Full-screen garment-parts picker (hood / collar / pocket / sleeve /
 * closure + fabric effects), in the spirit of the M1M4 reference sheets.
 * Picking a shape hands its data URL back so it is added to the design
 * immediately through the normal decal system — it stays OPEN after each
 * pick so several parts can be added in a row, with a flash of
 * confirmation on the tile that was just added.
 */
export default function GarmentPartsSheet({
  open,
  onClose,
  onPick,
  ar,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (dataUrl: string, label: string) => void;
  ar: boolean;
}) {
  const [cat, setCat] = useState<GarmentPartCategory | "effects" | "all">("all");
  const [addedId, setAddedId] = useState<string | null>(null);
  const t = (en: string, arText: string) => (ar ? arText : en);

  useEffect(() => {
    if (!addedId) return;
    const timer = setTimeout(() => setAddedId(null), 900);
    return () => clearTimeout(timer);
  }, [addedId]);

  if (!open) return null;

  const toItem = (x: { id: string; dataUrl: string; en: string; ar: string }) =>
    ({ id: x.id, dataUrl: x.dataUrl, label: ar ? x.ar : x.en });

  const items =
    cat === "effects"
      ? FABRIC_EFFECTS.map(toItem)
      : cat === "all"
        ? [...GARMENT_PARTS.map(toItem), ...FABRIC_EFFECTS.map(toItem)]
        : GARMENT_PARTS.filter((p) => p.category === cat).map(toItem);

  const tabs = [
    { id: "all" as const, en: "All", ar: "الكل" },
    ...PART_CATEGORIES,
    { id: "effects" as const, en: "Effects", ar: "تأثيرات" },
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex flex-col" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2 p-4 border-b border-white/10">
        <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-[0_0_12px_rgba(139,92,246,0.8)]" />
        <h2 className="text-base font-black text-white">{t("أجزاء الملابس", "Garment parts")}</h2>
        <span className="text-[10px] text-white/40 hidden sm:inline">
          {t("اضغط أي شكل — ينضاف فوراً على المربع المحدد وعلى المجسم", "Tap any shape — it lands instantly on the selected panel & the 3D mockup")}
        </span>
        <button onClick={onClose} className="ml-auto w-9 h-9 grid place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition">
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {tabs.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id as GarmentPartCategory | "effects" | "all")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black border transition ${
              cat === c.id
                ? "bg-gradient-to-r from-violet-500/40 to-fuchsia-500/40 border-violet-300 text-white"
                : "bg-white/[0.05] border-white/10 text-white/60 hover:border-white/25"
            }`}
          >
            {t(c.en, c.ar)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onPick(item.dataUrl, item.label);
                setAddedId(item.id); // stays open — add as many as you like
              }}
              className={`relative rounded-2xl bg-white/95 border p-2 flex flex-col items-center gap-1 transition active:scale-95 ${
                addedId === item.id ? "border-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.5)]" : "border-white/10 hover:border-violet-400"
              }`}
            >
              <img src={item.dataUrl} alt={item.label} className="w-full aspect-square object-contain" />
              <span className="text-[10px] font-bold text-black/70 leading-tight text-center">{item.label}</span>
              {addedId === item.id && (
                <span className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-emerald-400 text-black flex items-center justify-center shadow-[0_0_10px_rgba(52,211,153,0.8)]">
                  <Check size={12} strokeWidth={3.5} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-white/10 flex items-center gap-3">
        <span className="text-[10px] text-white/40 flex-1">
          {t("كل إضافة تنزل على المربع المحدد في المخطط وتنعكس تلقائياً على الثلاثي الأبعاد (للأمام/الخلف)", "Each pick lands on the selected mockup panel and syncs to the 3D garment (front/back) automatically")}
        </span>
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-black active:scale-95 transition"
        >
          {t("تم", "Done")}
        </button>
      </div>
    </div>
  );
}
