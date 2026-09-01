import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Store, Wand2, Loader2, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getMyShop, upsertShop, type Shop } from "@/lib/shop";
import { generateShopBranding } from "@/lib/shop.functions";
import type { Lang } from "@/lib/i18n";

/**
 * Real shop customization — name, tagline, banner gradient, saved to the
 * `shops` table (018_shops.sql), plus an AI "build it for me" button for
 * anyone who doesn't know how to design one. Honest scope: this styles a
 * branded header for the seller's listings within MODELZON's existing
 * marketplace/checkout — it is NOT a separate storefront app, custom
 * checkout flow, or app ecosystem like Shopify; it reuses the same
 * Stripe/Connect pipeline every other listing already uses.
 */
export default function MyShopCard({ userId, lang }: { userId: string; lang: Lang }) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [shop, setShop] = useState<Shop | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [colorFrom, setColorFrom] = useState("#22d3ee");
  const [colorTo, setColorTo] = useState("#d946ef");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const generateFn = useServerFn(generateShopBranding);

  useEffect(() => {
    getMyShop(userId).then((s) => {
      setShop(s);
      if (s) { setName(s.shop_name); setTagline(s.tagline); setColorFrom(s.banner_from); setColorTo(s.banner_to); }
      else setEditing(true);
    });
  }, [userId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const r = await generateFn({ data: {} });
      setName(r.name); setTagline(r.tagline); setColorFrom(r.colorFrom); setColorTo(r.colorTo);
    } catch {
      toast.error(t("AI generation failed — try again", "تعذّر التوليد — حاول مرة ثانية"));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t("Shop name is required", "اسم المتجر مطلوب")); return; }
    setSaving(true);
    const result = await upsertShop({ user_id: userId, shop_name: name.trim(), tagline: tagline.trim(), banner_from: colorFrom, banner_to: colorTo });
    setSaving(false);
    if (result.ok) { setShop({ user_id: userId, shop_name: name.trim(), tagline: tagline.trim(), banner_from: colorFrom, banner_to: colorTo }); setEditing(false); toast.success(t("Shop saved 🏪", "تم حفظ المتجر 🏪")); }
    else toast.error(result.message ?? t("Couldn't save shop", "تعذّر الحفظ"));
  };

  return (
    <div className="mb-5 rounded-2xl overflow-hidden border border-white/10">
      <div className="p-4" style={{ background: `linear-gradient(135deg, ${colorFrom}33, ${colorTo}33)` }}>
        {editing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-white/70 mb-1">
              <Store size={13} /> {t("Design your shop", "صمّم متجرك")}
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Shop name", "اسم المتجر")}
              className="w-full rounded-lg bg-black/40 border border-white/10 text-sm px-3 py-2 text-white outline-none focus:border-cyan-400/50" />
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder={t("Tagline", "شعار قصير")}
              className="w-full rounded-lg bg-black/40 border border-white/10 text-xs px-3 py-2 text-white outline-none focus:border-cyan-400/50" />
            <div className="flex items-center gap-2">
              <input type="color" value={colorFrom} onChange={(e) => setColorFrom(e.target.value)} className="w-8 h-8 rounded-lg bg-transparent" />
              <input type="color" value={colorTo} onChange={(e) => setColorTo(e.target.value)} className="w-8 h-8 rounded-lg bg-transparent" />
              <span className="text-[10px] text-white/40">{t("Banner colors", "ألوان البانر")}</span>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-100 text-[11px] font-bold disabled:opacity-50"
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} {t("AI build for me", "الذكاء الاصطناعي يبنيه")}
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              {shop && <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs">{t("Cancel", "إلغاء")}</button>}
              <button onClick={handleSave} disabled={saving} className="flex-1 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {t("Save shop", "حفظ المتجر")}
              </button>
            </div>
          </div>
        ) : shop ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-black" style={{ color: colorFrom }}>{shop.shop_name}</div>
              {shop.tagline && <div className="text-xs text-white/60">{shop.tagline}</div>}
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={`/shop/${userId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/30 text-cyan-200"
              >
                <ExternalLink size={11} /> {t("View shop", "شوف متجرك")}
              </a>
              <button onClick={() => setEditing(true)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-black/30 text-white/60">{t("Edit shop", "تعديل")}</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
