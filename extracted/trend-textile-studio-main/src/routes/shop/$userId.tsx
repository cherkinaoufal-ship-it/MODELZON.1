import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getMyShop, type Shop } from "@/lib/shop";

export const Route = createFileRoute("/shop/$userId")({
  component: ShopPage,
});

type ShopDesign = {
  id: string;
  title: string;
  garment: string;
  color: string;
  decal_url: string | null;
  price_cents: number;
};

type ShopOwner = { username: string; level: number; avatar_url: string | null; subscription_tier: string };

/**
 * Public storefront — the "other people can actually visit this" half of
 * the shop feature (customization itself lives in MyShopCard, shown on the
 * owner's own Profile tab). Anyone can open this, no login required to
 * browse; buying still routes through the normal marketplace checkout.
 */
function ShopPage() {
  const { userId } = useParams({ from: "/shop/$userId" });
  const [shop, setShop] = useState<Shop | null>(null);
  const [owner, setOwner] = useState<ShopOwner | null>(null);
  const [designs, setDesigns] = useState<ShopDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [shopRes, ownerRes, designsRes] = await Promise.all([
        getMyShop(userId),
        supabase.from("profiles").select("username, level, avatar_url, subscription_tier").eq("id", userId).maybeSingle(),
        supabase.from("designs").select("id, title, garment, color, decal_url, price_cents").eq("user_id", userId).eq("for_sale", true).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (!ownerRes.data) { setNotFound(true); setLoading(false); return; }
      setShop(shopRes);
      setOwner(ownerRes.data as ShopOwner);
      setDesigns((designsRes.data ?? []) as ShopDesign[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white/40">…</div>;
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white/50 gap-3">
        <Store size={32} className="opacity-30" />
        <p>Shop not found.</p>
        <Link to="/" className="text-cyan-300 text-sm hover:underline">← Back to MODELZON</Link>
      </div>
    );
  }

  const colorFrom = shop?.banner_from ?? "#22d3ee";
  const colorTo = shop?.banner_to ?? "#d946ef";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="p-6" style={{ background: `linear-gradient(135deg, ${colorFrom}33, ${colorTo}22)` }}>
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80 mb-4">
          <ArrowLeft size={13} /> MODELZON
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-xl font-black text-black shrink-0">
            {owner?.avatar_url ? <img src={owner.avatar_url} className="w-full h-full object-cover" /> : owner?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-black flex items-center gap-1.5" style={{ color: colorFrom }}>
              {shop?.shop_name ?? `${owner?.username}'s Shop`}
              {(owner?.level ?? 0) >= 50 || owner?.subscription_tier === "elite" ? (
                <ShieldCheck size={16} className="text-cyan-300" />
              ) : null}
            </h1>
            {shop?.tagline && <p className="text-sm text-white/60 mt-0.5">{shop.tagline}</p>}
            <p className="text-[11px] text-white/40 mt-1">by {owner?.username} · LVL {owner?.level}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {designs.length === 0 ? (
          <p className="text-center text-white/30 text-sm py-16">Nothing listed yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {designs.map((d) => (
              <Link key={d.id} to="/" className="group rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] hover:border-cyan-400/40 transition">
                <div className="aspect-square flex items-center justify-center" style={{ backgroundColor: d.color }}>
                  {d.decal_url && <img src={d.decal_url} alt={d.title} className="w-full h-full object-cover" />}
                </div>
                <div className="p-2">
                  <div className="text-xs font-bold truncate">{d.title || d.garment}</div>
                  <div className="text-[11px] text-emerald-300 font-mono mt-0.5">${(d.price_cents / 100).toFixed(0)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
