import type { Lang } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Shirt } from "lucide-react";
import { GARMENTS, CATEGORY_META, type GarmentItem, type Gender, type GarmentCategory } from "@/data/garments";
import catTee from "@/assets/cat-tee.jpg";
import catHoodie from "@/assets/cat-hoodie.jpg";
import catSweater from "@/assets/cat-sweater.jpg";
import catPants from "@/assets/cat-pants.jpg";
import catShorts from "@/assets/cat-shorts.jpg";
import catSkirt from "@/assets/cat-skirt.jpg";
import catCap from "@/assets/cat-cap.jpg";

const PHOTO: Record<GarmentCategory, string> = {
  tee: catTee,
  hoodie: catHoodie,
  sweater: catSweater,
  pants: catPants,
  shorts: catShorts,
  skirt: catSkirt,
  cap: catCap,
};


interface Props {
  lang: Lang;
  onPick: (item: GarmentItem) => void;
}

const GENDERS: { id: Gender | "all"; ar: string; en: string }[] = [
  { id: "all", ar: "الكل", en: "All" },
  { id: "men", ar: "رجالي", en: "Men" },
  { id: "women", ar: "نسائي", en: "Women" },
  { id: "unisex", ar: "الجنسين", en: "Unisex" },
];

export default function GarmentLibrary({ lang, onPick }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [gender, setGender] = useState<Gender | "all">("all");
  const [category, setCategory] = useState<GarmentCategory | "all">("all");

  const categories = useMemo(() => {
    const set = new Set<GarmentCategory>(GARMENTS.map((g) => g.category));
    return Array.from(set);
  }, []);

  const filtered = GARMENTS.filter(
    (g) => (gender === "all" || g.gender === gender) && (category === "all" || g.category === category)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shirt className="text-fuchsia-400" size={18} />
        <h2 className="text-lg font-black">{t("Garment Library", "مكتبة الملابس")}</h2>
        <span className="ml-auto text-[10px] text-white/50">{t("Tap a piece to edit it", "اضغط القطعة لتعديلها")}</span>
      </div>

      {/* Gender toggle */}
      <div className="flex gap-2">
        {GENDERS.map((g) => (
          <button
            key={g.id}
            onClick={() => setGender(g.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
              gender === g.id
                ? "bg-cyan-500/25 border-cyan-400 text-cyan-100"
                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
            }`}
          >
            {t(g.en, g.ar)}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategory("all")}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border ${
            category === "all" ? "bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100" : "bg-white/5 border-white/10 text-white/60"
          }`}
        >
          {t("All", "الكل")}
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 ${
              category === c ? "bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100" : "bg-white/5 border-white/10 text-white/60"
            }`}
          >
            <span>{CATEGORY_META[c].emoji}</span>
            {t(CATEGORY_META[c].en, CATEGORY_META[c].ar)}
          </button>
        ))}
      </div>

      {/* Catalogue grid — clean, evenly-spaced product tiles (mockup-library
          style) rendered in the app's own dark neon palette instead of a
          white marketplace sheet. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px rounded-2xl overflow-hidden bg-white/[0.06] border border-white/10">
        {filtered.map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPick(item)}
            className="group relative bg-[#0d0715] hover:bg-[#160c22] transition text-left"
          >
            <div className="relative aspect-[4/5] overflow-hidden flex items-center justify-center p-3">
              <img
                src={PHOTO[item.category]}
                alt={t(item.en, item.ar)}
                loading="lazy"
                width={768}
                height={768}
                className="w-full h-full object-contain transition duration-500 group-hover:scale-[1.04]"
                style={{ filter: "saturate(0.9) contrast(1.05)" }}
              />
              <div
                className="absolute inset-0 mix-blend-multiply opacity-40 pointer-events-none"
                style={{ background: item.color }}
              />
              <span
                className="absolute top-2 end-2 w-5 h-5 rounded-full bg-white/[0.06] border border-white/15 text-[9px] font-black text-white/50 flex items-center justify-center group-hover:border-cyan-400/60 group-hover:text-cyan-200"
                title={t(item.en, item.ar)}
              >
                i
              </span>
            </div>
            <div className="px-2.5 pb-2.5 pt-1">
              <div className="font-bold text-[11px] leading-tight truncate">{t(item.en, item.ar)}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-3 h-3 rounded-full border border-white/25" style={{ background: item.color }} />
                <span className="text-[9px] text-white/35">
                  {CATEGORY_META[item.category].en === "Tee" ? "" : ""}
                  {t(CATEGORY_META[item.category].en, CATEGORY_META[item.category].ar)}
                </span>
              </div>
            </div>
          </motion.button>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center text-white/40 text-xs py-8 bg-[#0d0715]">
            {t("No garments match this filter", "لا توجد قطع مطابقة لهذا الفلتر")}
          </div>
        )}
      </div>

    </div>
  );
}
