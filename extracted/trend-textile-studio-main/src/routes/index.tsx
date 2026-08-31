import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { syncMissions, getProgress, MISSIONS, type Stats } from "@/lib/progress.functions";
import type { Lang } from "@/lib/i18n";
import { uploadAvatar } from "@/lib/avatar";
import { requestProduction } from "@/lib/production";
import type { ProductionMeasurements } from "@/lib/production";
import ProductionRequestDialog from "@/components/modelzon/ProductionRequestDialog";
import { listFriends, addFriend, removeFriend, FRIEND_LIMIT } from "@/lib/friends.functions";
import { DECORATION_TYPES, type DecorationTypeId, type FabricTypeId } from "@/lib/materialPresets";

import MyShopCard from "@/components/modelzon/MyShopCard";
import type { CurrencyCode } from "@/lib/currency";
import { convertUsdCentsToCurrency, formatMoney } from "@/lib/currency";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shirt, HardHat, Crown, Trophy, Lock, ShoppingBag,
  Settings, MessageSquare, Sparkles, X, Bot, User, Coins,
  Palette as PaletteIcon, Swords, Store, Library, Brush, Clapperboard,
  Snowflake, Sun, CheckCircle2, Circle, Camera, Factory, Users,
  Image as ImageIcon, LayoutGrid, RotateCw, PersonStanding, Footprints, Wind,
  CreditCard, Grid3x3, SlidersHorizontal, Shield, Sticker, Upload,
} from "lucide-react";
import ChatPanel from "@/components/modelzon/ChatPanel";
import ShortsFeed from "@/components/modelzon/ShortsFeed";
import ProToolbar from "@/components/modelzon/ProToolbar";
import ColorPickerHSV from "@/components/modelzon/ColorPickerHSV";
import DecorationIcon from "@/components/modelzon/DecorationIcon";
import GarmentPartsSheet from "@/components/modelzon/GarmentPartsSheet";
import MockupBoard2D, { type MockupSide, type MockupSlot } from "@/components/modelzon/MockupBoard2D";

import { DEFAULT_BRUSH, type BrushSettings } from "@/lib/paint-engine";
import { DEFAULT_DECAL_TRANSFORM, type DecalTransform } from "@/components/modelzon/DecalControls";

import SettingsPanel from "@/components/modelzon/SettingsPanel";
import XPBar from "@/components/modelzon/XPBar";
import RankCards, { RANKS, RankBadge } from "@/components/modelzon/RankCards";
import AIDesignChat from "@/components/modelzon/AIDesignChat";
import ArenaHero from "@/components/modelzon/ArenaHero";
import ArenaBoard from "@/components/modelzon/ArenaBoard";
import CompetitorsRoom from "@/components/modelzon/CompetitorsRoom";
import GarmentLibrary from "@/components/modelzon/GarmentLibrary";
import type { GarmentType, SizeId, Studio3DHandle, GarmentPose } from "@/components/Studio3D";
import type { GarmentItem } from "@/data/garments";
import { SIZES } from "@/data/garments";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import AuthGate from "@/components/modelzon/AuthGate";
import { Loader2, Save, Trash2 } from "lucide-react";
import { saveDesign, listMyDesigns, deleteDesign, type SavedDesign } from "@/lib/designs";
import { fetchTopPlayers, type LeaderboardEntry } from "@/lib/leaderboard";
import { fetchMarketplace, listDesignForSale, unlistDesign, createPendingOrder, type MarketplaceListing } from "@/lib/marketplace";
import { createCheckoutSession, confirmCheckoutSession } from "@/lib/stripe.functions";
import ShippingAddressDialog, { type ShippingAddress } from "@/components/modelzon/ShippingAddressDialog";
import AIGraphicAssistant from "@/components/modelzon/AIGraphicAssistant";
import BattleRoom from "@/components/modelzon/BattleRoom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isNativeAndroid, initRevenueCat, purchaseTierNative, openNativeSubscriptionManagement } from "@/lib/revenuecat";
import { createConnectOnboardingLink, syncConnectStatus } from "@/lib/stripe-connect.functions";
import { createSubscriptionCheckout, confirmSubscriptionCheckout, openBillingPortal, TIER_PRICES_CENTS, type SubTier } from "@/lib/subscription.functions";
import { useArenaPresence } from "@/lib/presence";
import { toast } from "sonner";


const Studio3D = lazy(() => import("@/components/Studio3D"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MODELZON — 3D Fashion Design Arena" },
      { name: "description", content: "Design, battle, and stream ultra-realistic 3D clothing. Style library, painting tools, ranked arenas, and creator monetization." },
      { property: "og:title", content: "MODELZON — 3D Fashion Design Arena" },
      { property: "og:description", content: "3D fashion battles, style library, and creator marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Modelzon,
});

type TabId = "studio" | "arena" | "styles" | "feed" | "market" | "ranks" | "profile";

const GARMENTS: { id: GarmentType; label: string; icon: any }[] = [
  { id: "tee", label: "Tee", icon: Shirt },
  { id: "hoodie", label: "Hoodie", icon: Shirt },
  { id: "sweater", label: "Sweater", icon: Shirt },
  { id: "cap", label: "Cap", icon: HardHat },
  { id: "pants", label: "Pants", icon: Crown },
  { id: "shorts", label: "Shorts", icon: Crown },
  { id: "skirt", label: "Skirt", icon: Crown },
];

const PALETTE = ["#22d3ee", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#f43f5e", "#0f172a", "#f8fafc"];
// Exclusive colors gated behind a Pro/Elite subscription (see profiles.subscription_tier).

/** Client-side gate only — there's no backend/auth in this app, so this just
 *  hides the API Keys panel from casual visitors on a shared link. Anyone who
 *  opens devtools can bypass it. Change this PIN to something only you know,
 *  and if these keys are truly sensitive, move them to a real backend/env
 *  var instead of the browser. */
const OWNER_PIN = "2580";

/**
 * Garment part/texture stickers — real inline SVG assets (no external
 * files, so nothing can 404), placed exactly like uploaded artwork (same
 * DecalControls: full drag/resize/rotate). See fabricEffects.ts for the
 * honest scope note on what "mesh reveals what's underneath" actually
 * means here (the garment's own layers, not a body — there's no body mesh
 * in this project).
 */

const NAV: { id: TabId; icon: any; en: string; ar: string; minLevel?: number }[] = [
  { id: "studio", icon: Shirt, en: "Studio", ar: "الاستوديو" },
  { id: "arena", icon: Swords, en: "Arena", ar: "الساحة" },
  { id: "styles", icon: Library, en: "Garments", ar: "الملابس" },
  { id: "feed", icon: Clapperboard, en: "Reels", ar: "ريلز" },
  // Hidden from the bottom bar until Level 50 (or Elite) — same gate as
  // marketplace selling itself (see 003_marketplace.sql) — then it just
  // appears on its own, no announcement needed.
  { id: "market", icon: Store, en: "Market", ar: "السوق", minLevel: 50 },
  { id: "profile", icon: User, en: "Profile", ar: "الملف" },
  // "Ranks" removed from the bottom bar — it now lives as an icon inside
  // Profile (see the trophy button next to the avatar), since it's
  // something you check occasionally, not a primary destination.
];

function Modelzon() {
  const { user, profile, loading: authLoading, signOut, updateProfile, refreshProfile } = useAuth();
  const studioRef = useRef<Studio3DHandle>(null);

  // Initialize RevenueCat as soon as we know who's signed in, but only on
  // native Android — no-op everywhere else (see isNativeAndroid()).
  useEffect(() => {
    if (user?.id) void initRevenueCat(user.id);
  }, [user?.id]);

  const [garment, setGarment] = useState<GarmentType>("hoodie");
  const [color, setColor] = useState("#a855f7");
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [size, setSize] = useState<SizeId>("M");
  const [profileName, setProfileName] = useState("Sultan_Design");
  const [profileBio, setProfileBio] = useState("Elite 3D Streetwear Designer • Multi-Battle Champion ⚡");
  // playerId is now the real Supabase auth user id — stable per account, not per browser.
  const playerId = user ? `MZ-${user.id.slice(0, 6).toUpperCase()}` : "MZ-000000";


  const [brush, setBrush] = useState<BrushSettings>({ ...DEFAULT_BRUSH, tool: "select" });
  const [frozen, setFrozen] = useState(false);
  const [undoSignal, setUndoSignal] = useState(0);
  const [clearSignal, setClearSignal] = useState(0);
  const [topic, setTopic] = useState("ستريت وير سعودي بخط عربي ذهبي");
  const [fabricType] = useState<FabricTypeId>("cotton");
  const [decorationType, setDecorationType] = useState<DecorationTypeId>("screen");
  const [decorationTypeBack, setDecorationTypeBack] = useState<DecorationTypeId>("screen");
  const [decalUrl, setDecalUrl] = useState<string | null>(null);
  const [decalHistory, setDecalHistory] = useState<(string | null)[]>([null]);
  const [decalTransform, setDecalTransform] = useState<DecalTransform>(DEFAULT_DECAL_TRANSFORM);
  const [decalUrlBack, setDecalUrlBack] = useState<string | null>(null);
  const [decalTransformBack, setDecalTransformBack] = useState<DecalTransform>(DEFAULT_DECAL_TRANSFORM);
  const [decalSide, setDecalSide] = useState<MockupSide>("front");
  const [studioPanel, setStudioPanel] = useState<"garments" | "artwork" | "fit" | "ai" | "paint" | "bg" | "layout">("garments");
  const [partsSheetOpen, setPartsSheetOpen] = useState(false);
  // Sleeve/leg panels of the 2D mockup board — layout-only artwork slots for
  // now (catalog .glb models carry artist UVs, so there's no reliable sleeve
  // print area on the 3D mesh). Front/back stay the real 3D-backed slots.
  const [sleeveSlotL, setSleeveSlotL] = useState<MockupSlot>({ url: null, transform: DEFAULT_DECAL_TRANSFORM });
  const [sleeveSlotR, setSleeveSlotR] = useState<MockupSlot>({ url: null, transform: DEFAULT_DECAL_TRANSFORM });

  const [studioBg, setStudioBg] = useState("#000000");
  const [profileTab, setProfileTab] = useState<"designs" | "plan" | "payouts" | "friends" | "settings">("designs");
  const [pose, setPose] = useState<GarmentPose>("stand");
  const artworkFileRef = useRef<HTMLInputElement>(null);



  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const xpToNext = 1000;
  const [coins, setCoins] = useState(0);
  const [popups, setPopups] = useState<{ id: number; text: string }[]>([]);
  const [userScore, setUserScore] = useState(0);
  const [missions, setMissions] = useState(0);

  const [lang, setLang] = useState<Lang>("en"); // new sessions default to English; the person changes it themselves in Settings — never auto-detected/forced
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const [privacy, setPrivacy] = useState(true);
  // Privacy switch is a real protection flag: it persists to the profile and
  // RLS uses it to decide whether visitors can read this user's designs.
  const changePrivacy = useCallback((v: boolean) => {
    setPrivacy(v);
    void updateProfile({ is_private: v });
  }, [updateProfile]);
  const [volume, setVolume] = useState(70);
  const [visualizer, setVisualizer] = useState(true);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  // Hydrate local state from the real Supabase profile once it loads,
  // and keep Supabase in sync afterwards (debounced) whenever these change.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!profile) return;
    setProfileName(profile.username);
    setProfileBio(profile.bio);
    setAvatarUrl(profile.avatar_url ?? null);
    setLevel(profile.level);
    setXp(profile.xp % 1000); // xp column is lifetime total; the bar shows progress *within* the current level (see XP_PER_LEVEL in progress.functions.ts)
    setCoins(profile.coins);
    setUserScore(profile.score);
    setMissions(profile.missions);
    setLang(profile.lang);
    setPrivacy(profile.is_private ?? true);
    hydrated.current = true;
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated.current || !user) return;
    const t = setTimeout(() => {
      // level/xp/coins/score/missions are server-authoritative now (see
      // 013_missions_progress.sql + progress.functions.ts) — only `lang`
      // is legitimately something the client itself should ever write.
      updateProfile({ lang } as any);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const [battleTimer, setBattleTimer] = useState(180);
  const [tab, setTab] = useState<TabId>("styles");
  const [aiOpen, setAiOpen] = useState(false);
  const popupId = useRef(0);

  const [myDesigns, setMyDesigns] = useState<SavedDesign[]>([]);
  const [openDesign, setOpenDesign] = useState<SavedDesign | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [requestingProductionId, setRequestingProductionId] = useState<string | null>(null);

  // ---- Friends / Clan (Pro+ perk) ----
  const [friends, setFriends] = useState<{ id: string; username: string; level: number; avatar_url: string | null }[]>([]);
  const [friendIdInput, setFriendIdInput] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const listFriendsFn = useServerFn(listFriends);
  const addFriendFn = useServerFn(addFriend);
  const removeFriendFn = useServerFn(removeFriend);

  const refreshFriends = useCallback(async () => {
    if (!user) return;
    try { setFriends(await listFriendsFn({ data: { userId: user.id } }) as any); } catch { /* non-critical */ }
  }, [user, listFriendsFn]);

  useEffect(() => { if (user && tab === "profile") void refreshFriends(); }, [user?.id, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddFriend = useCallback(async () => {
    if (!user || !friendIdInput.trim()) return;
    setAddingFriend(true);
    try {
      await addFriendFn({ data: { userId: user.id, friendPlayerId: friendIdInput.trim() } });
      setFriendIdInput("");
      toast.success(t("Friend added 🎉", "تمت إضافة الصديق 🎉"));
      void refreshFriends();
    } catch (e: any) {
      toast.error(e?.message ?? t("Couldn't add friend", "تعذّر إضافة الصديق"));
    } finally {
      setAddingFriend(false);
    }
  }, [user, friendIdInput, addFriendFn, refreshFriends]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemoveFriend = useCallback(async (friendId: string) => {
    if (!user) return;
    await removeFriendFn({ data: { userId: user.id, friendId } });
    void refreshFriends();
  }, [user, removeFriendFn, refreshFriends]);

  const [productionDesignId, setProductionDesignId] = useState<string | null>(null);

  const handleRequestProduction = useCallback(async (measurements: ProductionMeasurements) => {
    if (!user || !productionDesignId) return;
    setRequestingProductionId(productionDesignId);

    // From the Studio button, the current design may not be saved yet at
    // all — save it first so there's a real design row to attach the
    // production request to, instead of silently failing on a fake id.
    let realDesignId = productionDesignId;
    if (productionDesignId === "studio-current") {
      const saveResult = await saveDesign({
        userId: user.id,
        garment, size, color,
        decalUrl, decalTransform: decalUrl ? decalTransform : null,
        decalUrlBack, decalTransformBack: decalUrlBack ? decalTransformBack : null,
        title: `${garment} · ${topic}`.slice(0, 80),
        paintDataUrl: studioRef.current?.getPaintDataUrl() ?? null,
      });
      if (!saveResult.ok) {
        setRequestingProductionId(null);
        toast.error(saveResult.reason === "duplicate"
          ? t("This exact design is already saved — request production from your saved designs instead.", "هذا التصميم محفوظ أصلاً — اطلب التصنيع من تصاميمك المحفوظة.")
          : t("Couldn't save the design first", "تعذّر حفظ التصميم أولاً"));
        return;
      }
      realDesignId = saveResult.design.id;
      refreshDesigns();
    }

    const result = await requestProduction(realDesignId, user.id, measurements);
    setRequestingProductionId(null);
    if (result.ok) {
      toast.success(t("Request sent — we'll follow up with pricing and timeline 🏭", "تم إرسال الطلب — بنتواصل معك بالسعر والمدة 🏭"));
      setProductionDesignId(null);
    } else {
      toast.error(result.message ?? t("Couldn't send request", "تعذّر إرسال الطلب"));
    }
  }, [user, lang, productionDesignId, garment, size, color, decalUrl, decalTransform, decalUrlBack, decalTransformBack, topic]); // eslint-disable-line react-hooks/exhaustive-deps

  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);
  const [battleActive, setBattleActive] = useState(false);
  const [designsLoading, setDesignsLoading] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);

  const [topPlayers, setTopPlayers] = useState<LeaderboardEntry[]>([]);
  const [viewingPlayer, setViewingPlayer] = useState<LeaderboardEntry | null>(null);
  const [viewedBio, setViewedBio] = useState("");
  const [viewedAvatar, setViewedAvatar] = useState<string | null>(null);
  const [viewedPrivate, setViewedPrivate] = useState(false);
  const [viewedDesigns, setViewedDesigns] = useState<SavedDesign[]>([]);

  // Load the tapped player's public card: bio + avatar always, saved designs
  // only when their Privacy switch is OFF (RLS enforces this server-side too).
  useEffect(() => {
    const id = viewingPlayer?.id;
    if (!id) { setViewedBio(""); setViewedAvatar(null); setViewedDesigns([]); setViewedPrivate(false); return; }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("profiles").select("bio, avatar_url, is_private").eq("id", id).maybeSingle();
      if (cancelled) return;
      const isPrivate = data?.is_private ?? true;
      setViewedBio(data?.bio ?? "");
      setViewedAvatar(data?.avatar_url ?? null);
      setViewedPrivate(isPrivate && id !== user?.id);
      if (isPrivate && id !== user?.id) { setViewedDesigns([]); return; }
      const { data: designs } = await supabase
        .from("designs")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(9);
      if (!cancelled) setViewedDesigns((designs ?? []) as SavedDesign[]);
    })();
    return () => { cancelled = true; };
  }, [viewingPlayer?.id, user?.id]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    if (tab !== "ranks" || !user) return;
    setLeaderboardLoading(true);
    fetchTopPlayers(10).then((rows) => {
      setTopPlayers(rows);
      setLeaderboardLoading(false);
    });
  }, [tab, user, level, xp]); // refetch when tab opens or the user's own level/xp changes

  const [marketListings, setMarketListings] = useState<MarketplaceListing[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [sellPriceDraft, setSellPriceDraft] = useState<Record<string, string>>({});
  const [shippingListing, setShippingListing] = useState<MarketplaceListing | null>(null);

  const refreshMarket = useCallback(async () => {
    setMarketLoading(true);
    setMarketListings(await fetchMarketplace());
    setMarketLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "market" && user) refreshMarket();
  }, [tab, user, refreshMarket]);

  const handleListForSale = useCallback(async (designId: string) => {
    const raw = sellPriceDraft[designId];
    const dollars = Number(raw);
    if (!raw || Number.isNaN(dollars) || dollars <= 0) {
      toast.error(lang === "ar" ? "اكتب سعر صحيح أكبر من صفر" : "Enter a valid price");
      return;
    }
    const result = await listDesignForSale(designId, Math.round(dollars * 100));
    if (result.ok) {
      toast.success(lang === "ar" ? "تم عرض تصميمك بالسوق 🎉" : "Listed on the marketplace 🎉");
      refreshDesigns();
      void refreshMissions();
    } else {
      toast.error(result.message ?? (lang === "ar" ? "تعذّر عرض التصميم" : "Couldn't list the design"));
    }
  }, [sellPriceDraft, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlist = useCallback(async (designId: string) => {
    if (await unlistDesign(designId)) {
      toast.success(lang === "ar" ? "تم سحب التصميم من السوق" : "Removed from the marketplace");
      refreshDesigns();
    }
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuy = useCallback((listing: MarketplaceListing) => {
    if (!user) return;
    if (listing.user_id === user.id) {
      toast.error(lang === "ar" ? "ما تقدر تشتري تصميمك أنت" : "You can't buy your own design");
      return;
    }
    // Collect a real shipping address first — see ShippingAddressDialog.
    setShippingListing(listing);
  }, [user, lang]);

  const handleConfirmPurchase = useCallback(async (address: ShippingAddress) => {
    const listing = shippingListing;
    if (!user || !listing) return;
    setBuyingId(listing.id);
    const order = await createPendingOrder({
      designId: listing.id,
      buyerId: user.id,
      sellerId: listing.user_id,
      priceCents: listing.price_cents,
      shipping: address,
    });
    if (!order.ok || !order.orderId) {
      setBuyingId(null);
      toast.error(order.message ?? (lang === "ar" ? "تعذّر إتمام الطلب" : "Couldn't place the order"));
      return;
    }
    try {
      const session = await createCheckoutSession({
        data: {
          orderId: order.orderId,
          sellerId: listing.user_id,
          title: listing.title || listing.garment,
          priceCents: listing.price_cents,
          origin: window.location.origin,
          currency,
        },
      });
      setShippingListing(null);
      window.location.href = session.url; // hand off to Stripe's hosted checkout page
    } catch (e) {
      setBuyingId(null);
      toast.error(lang === "ar" ? "تعذّر فتح صفحة الدفع، حاول مرة ثانية" : "Couldn't open checkout, try again");
    }
  }, [user, lang, shippingListing, currency]);

  const [subscribing, setSubscribing] = useState<SubTier | null>(null);

  const handleSubscribe = useCallback(async (tier: SubTier) => {
    if (!user) return;
    setSubscribing(tier);

    // Google Play policy requires Android in-app subscriptions to go
    // through Google Play Billing — RevenueCat handles that path; Stripe
    // stays exactly as-is for web. See src/lib/revenuecat.ts.
    if (isNativeAndroid()) {
      const result = await purchaseTierNative(tier);
      setSubscribing(null);
      if (result.ok) {
        toast.success(lang === "ar" ? `تم تفعيل اشتراك ${tier.toUpperCase()} 🎉` : `${tier.toUpperCase()} subscription activated 🎉`);
        await refreshProfile();
      } else if (!result.cancelled) {
        toast.error(result.message ?? (lang === "ar" ? "تعذّر إتمام الاشتراك" : "Couldn't complete the subscription"));
      }
      return;
    }

    try {
      const session = await createSubscriptionCheckout({ data: { tier, userId: user.id, origin: window.location.origin, currency } });
      window.location.href = session.url;
    } catch {
      setSubscribing(null);
      toast.error(lang === "ar" ? "تعذّر فتح صفحة الاشتراك" : "Couldn't open subscription checkout");
    }
  }, [user, lang, refreshProfile, currency]);

  const handleManageBilling = useCallback(async () => {
    if (isNativeAndroid()) {
      await openNativeSubscriptionManagement();
      return;
    }
    if (!profile?.stripe_customer_id) return;
    try {
      const portal = await openBillingPortal({ data: { customerId: profile.stripe_customer_id, origin: window.location.origin } });
      window.location.href = portal.url;
    } catch {
      toast.error(lang === "ar" ? "تعذّر فتح صفحة إدارة الاشتراك" : "Couldn't open billing portal");
    }
  }, [profile?.stripe_customer_id, lang]);

  const [connecting, setConnecting] = useState(false);
  const handleConnectPayouts = useCallback(async () => {
    if (!user?.email) return;
    setConnecting(true);
    try {
      const link = await createConnectOnboardingLink({ data: { userId: user.id, email: user.email, origin: window.location.origin } });
      window.location.href = link.url;
    } catch {
      setConnecting(false);
      toast.error(lang === "ar" ? "تعذّر فتح صفحة ربط حساب الدفع" : "Couldn't open payout account setup");
    }
  }, [user, lang]);

  // If we just came back from Stripe Connect onboarding, re-check the real
  // status with Stripe (never trust the redirect alone).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect") === "return" && user) {
      syncConnectStatus({ data: { userId: user.id } })
        .then((status) => {
          if (status.chargesEnabled) {
            toast.success(lang === "ar" ? "تم ربط حساب استلام الأرباح 🎉" : "Payout account connected 🎉");
            refreshProfile();
          } else {
            toast(lang === "ar" ? "الحساب مربوط بس لسا فيه خطوات ناقصة بستريب" : "Account linked but Stripe still needs more info from you");
          }
        })
        .catch(() => {});
    }
  }, [user, lang, refreshProfile]);

  // Handle the redirect back from Stripe (?checkout=... for one-time orders,
  // ?sub=... for subscription checkouts).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const sub = params.get("sub");
    if (!checkout && !sub) return;
    const orderId = params.get("order");
    const sessionId = params.get("session_id");
    const tier = params.get("tier") as SubTier | null;

    (async () => {
      if (checkout === "success" && orderId && sessionId) {
        try {
          const result = await confirmCheckoutSession({ data: { sessionId, orderId } });
          toast[result.paid ? "success" : "error"](
            result.paid
              ? lang === "ar" ? "تم الدفع بنجاح! 🎉 التصميم صار لك" : "Payment successful! 🎉"
              : lang === "ar" ? "ما انتأكد الدفع، تواصل معنا لو فيه مبلغ اتخصم" : "Payment could not be verified",
          );
        } catch {
          toast.error(lang === "ar" ? "صار خطأ بتأكيد الدفع" : "Error confirming payment");
        }
      } else if (checkout === "cancel") {
        toast(lang === "ar" ? "تم إلغاء الدفع" : "Checkout cancelled");
      } else if (sub === "success" && sessionId && tier && user) {
        setSubscribing(null);
        try {
          const result = await confirmSubscriptionCheckout({ data: { sessionId, userId: user.id, tier } });
          if (result.active) {
            toast.success(lang === "ar" ? `تم تفعيل اشتراك ${tier.toUpperCase()} 🎉` : `${tier.toUpperCase()} subscription activated 🎉`);
            refreshProfile();
          } else {
            toast.error(lang === "ar" ? "ما انتأكد الاشتراك" : "Subscription could not be verified");
          }
        } catch {
          toast.error(lang === "ar" ? "صار خطأ بتأكيد الاشتراك" : "Error confirming subscription");
        }
      } else if (sub === "cancel") {
        setSubscribing(null);
        toast(lang === "ar" ? "تم إلغاء الاشتراك" : "Subscription cancelled");
      }
      window.history.replaceState({}, "", window.location.pathname);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const refreshDesigns = useCallback(async () => {
    if (!user) return;
    setDesignsLoading(true);
    const rows = await listMyDesigns(user.id);
    setMyDesigns(rows);
    setDesignsLoading(false);
  }, [user]);

  useEffect(() => {
    if (tab === "profile" && user) refreshDesigns();
  }, [tab, user, refreshDesigns]);

  const handleSaveDesign = useCallback(async () => {
    if (!user) return;
    setSavingDesign(true);
    const result = await saveDesign({
      userId: user.id,
      garment,
      size,
      color,
      decalUrl,
      decalTransform: decalUrl ? decalTransform : null,
      decalUrlBack,
      decalTransformBack: decalUrlBack ? decalTransformBack : null,
      title: `${garment} · ${topic}`.slice(0, 80),
      paintDataUrl: studioRef.current?.getPaintDataUrl() ?? null,
    });
    setSavingDesign(false);
    if (result.ok) {
      toast.success(lang === "ar" ? "تم حفظ التصميم ✅" : "Design saved ✅");
      void refreshMissions();
      refreshDesigns();
    } else if (result.reason === "duplicate") {
      toast.error(result.message);
    } else {
      toast.error(lang === "ar" ? "تعذّر حفظ التصميم، حاول مرة ثانية" : "Couldn't save the design, try again");
    }
  }, [user, garment, size, color, decalUrl, decalTransform, decalUrlBack, decalTransformBack, topic, lang, refreshDesigns]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteDesign = useCallback(async (id: string) => {
    const removed = await deleteDesign(id);
    if (removed) {
      setMyDesigns((d) => d.filter((x) => x.id !== id));
      toast.success(lang === "ar" ? "تم حذف التصميم" : "Design deleted");
    }
  }, [lang]);


  const grantXP = useCallback((amount: number, label: string) => {
    const id = ++popupId.current;
    setPopups((p) => [...p, { id, text: `+${amount} XP · ${label}` }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1200);
  }, []);

  const syncMissionsFn = useServerFn(syncMissions);
  const getProgressFn = useServerFn(getProgress);
  const [completedMissionIds, setCompletedMissionIds] = useState<string[]>([]);
  const [missionStats, setMissionStats] = useState<Stats | null>(null);

  /** The ONLY path that actually grants XP now — calls the server, which
   *  independently re-checks real stats (designs saved, battles judged,
   *  sales made) against the mission catalog and only writes xp/level/coins
   *  if something genuinely newly completed. Safe to call liberally after
   *  any action that might have finished a mission; a no-op otherwise. */
  const refreshMissions = useCallback(async () => {
    if (!user) return;
    try {
      const result = await syncMissionsFn({ data: { userId: user.id } });
      setXp(result.xpIntoLevel);
      setLevel(result.level);
      setCoins(result.coins);
      setMissionStats(result.stats);
      for (const m of result.newlyCompleted) {
        grantXP(m.xp, lang === "ar" ? m.titleAr : m.titleEn);
      }
      if (result.newlyCompleted.length > 0) {
        setCompletedMissionIds((ids) => [...ids, ...result.newlyCompleted.map((m) => m.id)]);
        refreshProfile();
      }
    } catch {
      /* non-critical — the UI just won't show a fresh mission popup this time */
    }
  }, [user, lang, syncMissionsFn, grantXP, refreshProfile]);

  // Re-check missions once after login/profile load, in case something
  // completed in a previous session before this system existed.
  useEffect(() => { if (user) void refreshMissions(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the full completed-missions list + live stats for the checklist UI
  // (refreshMissions above only returns what's newly completed each call).
  useEffect(() => {
    if (!user) return;
    getProgressFn({ data: { userId: user.id } })
      .then((p) => { setCompletedMissionIds(p.completedMissionIds); setMissionStats(p.stats); })
      .catch(() => {});
  }, [user?.id, getProgressFn]);

  useEffect(() => {
    const id = setInterval(() => setBattleTimer((t) => (t > 0 ? t - 1 : 180)), 1000);
    return () => clearInterval(id);
  }, []);

  // Entering the Studio always lands on the garment picker first: pick the
  // piece that suits you, and the design panels open automatically after
  // that (see applyGarment).
  useEffect(() => {
    if (tab === "studio") setStudioPanel("garments");
  }, [tab]);

  // The mouse-pointer "Move" tool is gone by request — painting vs
  // navigating is now contextual instead of a tool button: paint tools are
  // live only while the Paint panel is open; everywhere else, dragging on
  // the garment orbits it (see paintingActive in Studio3D).
  useEffect(() => {
    setBrush((b) =>
      studioPanel === "paint"
        ? { ...b, tool: b.tool === "select" ? "draw" : b.tool }
        : { ...b, tool: "select" },
    );
  }, [studioPanel]);

  const changeGarment = (g: GarmentType) => { setGarment(g); setModelPath(null); };
  const changeColor = (c: string) => { setColor(c); };

  // One shared entry point for putting artwork on the design — used by the
  // purple garment-parts picker, the mockup-board upload button, the Paint
  // panel upload and the AI assistant. It routes to whichever mockup panel
  // is active: front & back are the real 3D-backed decal slots (anything
  // added there shows up on the 3D garment automatically), the two
  // sleeve/leg panels are layout-only slots.
  const applyArtworkToSide = useCallback((dataUrl: string) => {
    if (decalSide === "back") {
      setDecalUrlBack(dataUrl);
      setDecalTransformBack(DEFAULT_DECAL_TRANSFORM);
    } else if (decalSide === "sleeveL") {
      setSleeveSlotL({ url: dataUrl, transform: DEFAULT_DECAL_TRANSFORM });
    } else if (decalSide === "sleeveR") {
      setSleeveSlotR({ url: dataUrl, transform: DEFAULT_DECAL_TRANSFORM });
    } else {
      setDecalHistory((h) => [...h, decalUrl]);
      setDecalUrl(dataUrl);
      setDecalTransform(DEFAULT_DECAL_TRANSFORM);
    }
  }, [decalSide, decalUrl]);

  const addPartToDesign = applyArtworkToSide;

  // Mockup-board slot plumbing (drag/resize/rotate on the 2D panels).
  const mockupSlots: Record<MockupSide, MockupSlot> = {
    front: { url: decalUrl, transform: decalTransform },
    back: { url: decalUrlBack, transform: decalTransformBack },
    sleeveL: sleeveSlotL,
    sleeveR: sleeveSlotR,
  };
  const setMockupTransform = useCallback((s: MockupSide, t: DecalTransform) => {
    if (s === "front") setDecalTransform(t);
    else if (s === "back") setDecalTransformBack(t);
    else if (s === "sleeveL") setSleeveSlotL((v) => ({ ...v, transform: t }));
    else setSleeveSlotR((v) => ({ ...v, transform: t }));
  }, []);
  const removeMockupArtwork = useCallback((s: MockupSide) => {
    if (s === "front") { setDecalUrl(null); setDecalTransform(DEFAULT_DECAL_TRANSFORM); }
    else if (s === "back") { setDecalUrlBack(null); setDecalTransformBack(DEFAULT_DECAL_TRANSFORM); }
    else if (s === "sleeveL") setSleeveSlotL({ url: null, transform: DEFAULT_DECAL_TRANSFORM });
    else setSleeveSlotR({ url: null, transform: DEFAULT_DECAL_TRANSFORM });
  }, []);

  const applyGarment = useCallback((item: GarmentItem) => {
    setGarment(item.category);
    setColor(item.color);
    setModelPath(item.path);
    setTab("studio");
    // Chosen a piece from the in-studio picker → straight into design mode.
    setStudioPanel("artwork");
    // (no XP for browsing the clothing library — missions reward real design work, see progress.functions.ts)
  }, []);

  const aiApply = useCallback((g: GarmentType, c: string) => {
    setGarment(g); setColor(c); setModelPath(null); setTab("studio"); setAiOpen(false); setStudioPanel("artwork");
    // (AI-generated art counts toward "Save your first design" once saved — no separate XP just for generating)
  }, []);

  const handleUploadImage = applyArtworkToSide;

  const handleUndo = () => {
    setDecalHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setDecalUrl(prev);
      return h.slice(0, -1);
    });
  };

  const presenceStatus = (() => {
    switch (tab) {
      case "studio": return lang === "ar" ? "بيصمم" : "In Studio";
      case "arena": return lang === "ar" ? "بالساحة" : "In Arena";
      case "market": return lang === "ar" ? "بالسوق" : "Browsing Market";
      default: return lang === "ar" ? "متصل" : "Online";
    }
  })();
  const onlinePlayers = useArenaPresence(
    user ? { userId: user.id, username: profileName, level } : null,
    presenceStatus,
  );

  // A paid plan only counts as active while it hasn't expired: the upgrade
  // section hides on successful payment and comes back once the paid period
  // is over (subscription_renews_at in the past).
  const hasActiveSub = Boolean(
    profile &&
      profile.subscription_tier !== "free" &&
      (!profile.subscription_renews_at || new Date(profile.subscription_renews_at).getTime() > Date.now()),
  );
  const verified = level >= 50 || profile?.subscription_tier === "elite" || profile?.subscription_tier === "pro"; // Pro tier's "instant verified checkmark" perk

  const visibleNav = NAV.filter((n) => !n.minLevel || level >= n.minLevel || profile?.subscription_tier === "elite");
  // If someone is on the (now-hidden) Market tab and hasn't unlocked it,
  // bounce them somewhere they can actually see — otherwise the content
  // area could render a tab with no visible way back to it.
  useEffect(() => {
    if (tab === "market" && !visibleNav.some((n) => n.id === "market")) setTab("styles");
  }, [tab, visibleNav]); // eslint-disable-line react-hooks/exhaustive-deps
  const mins = Math.floor(battleTimer / 60);
  const secs = String(battleTimer % 60).padStart(2, "0");
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);

  // Real auth gate: nothing below renders — and no XP/coins/design state can
  // drift — until there is a signed-in Supabase user.
  if (authLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }
  if (!user) {
    return <AuthGate />;
  }

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-black text-white overflow-hidden relative"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 10%, rgba(168,85,247,0.15), transparent 40%), radial-gradient(circle at 80% 90%, rgba(6,182,212,0.15), transparent 40%)",
      }}
    >
      <GarmentPartsSheet
        open={partsSheetOpen}
        onClose={() => setPartsSheetOpen(false)}
        onPick={(dataUrl) => addPartToDesign(dataUrl)}
        ar={lang === "ar"}
      />
      <header className="relative z-30 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/40 backdrop-blur-xl">

        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center font-black text-black text-sm shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            MZ
          </div>
          <div className="font-black tracking-widest text-sm">MODELZON</div>
          <span className="px-1.5 py-0.5 rounded border border-cyan-400/50 text-cyan-300 text-[9px] font-bold">3D</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 border-cyan-400/60 bg-cyan-500/5 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]">
            <span className="text-cyan-300 font-black text-sm">{level}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-amber-400/50 bg-amber-500/10">
            <Coins size={14} className="text-amber-300" />
            <span className="text-amber-200 font-black text-xs">${coins.toLocaleString()}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-mono text-red-300">{mins}:{secs}</span>
          </div>
        </div>
      </header>

      <main className="relative pb-24 lg:pb-4 min-h-[calc(100vh-72px)]">
        <div className="lg:grid lg:grid-cols-[240px_1fr_320px] lg:gap-4 lg:p-4 lg:h-[calc(100vh-72px)] lg:overflow-hidden">

          <aside className="hidden lg:flex flex-col gap-4 overflow-y-auto">
            <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 pointer-events-none select-none">
              <XPBar level={level} xp={xp} xpToNext={xpToNext} popups={popups} />
            </div>
            <nav className="rounded-2xl p-2 bg-white/[0.03] border border-white/10 flex flex-col gap-1">
              {visibleNav.map((n) => {
                const Icon = n.icon;
                const active = tab === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                      active ? "bg-cyan-500/15 text-cyan-200 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]" : "text-white/60 hover:bg-white/5"
                    }`}
                  >
                    <Icon size={16} /> {t(n.en, n.ar)}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-white/10 lg:bg-black/30 p-4 lg:p-0">
            {tab === "studio" && (
              <div className="space-y-3">
                <div className="lg:h-[70vh] relative rounded-2xl overflow-hidden border border-white/10 bg-black/40" style={{ height: "min(65vh, 560px)" }}>
                  <Suspense fallback={<div className="flex items-center justify-center h-full text-white/40">Loading studio…</div>}>
                    <Studio3D
                      ref={studioRef}
                      garment={garment} color={color} quality={quality}
                      brush={brush}
                      decalUrl={decalUrl} decalTransform={decalTransform}
                      decalUrlBack={decalUrlBack} decalTransformBack={decalTransformBack}
                      modelPath={modelPath} size={size}
                      fabricType={fabricType}
                      background={studioBg} pose={pose}
                      decorationType={decorationType} decorationTypeBack={decorationTypeBack}
                      frozen={frozen} undoSignal={undoSignal} clearSignal={clearSignal}
                    />
                  </Suspense>
                  <button
                    onClick={() => setFrozen((f) => !f)}
                    className={`absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border backdrop-blur transition ${
                      frozen ? "bg-cyan-500/25 border-cyan-400 text-cyan-100" : "bg-black/60 border-white/15 text-white/70"
                    }`}
                  >
                    {frozen ? <Snowflake size={12} /> : <Sun size={12} />}
                    {frozen ? t("Frozen", "مثبّت") : t("Freeze", "تثبيت")}
                  </button>
                  <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 text-[10px] font-mono text-white/60 backdrop-blur">
                    {quality.toUpperCase()} · {garment.toUpperCase()} · {size}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDesign}
                    disabled={savingDesign}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 bg-gradient-to-r from-emerald-400 to-cyan-400 text-black text-sm font-black disabled:opacity-60"
                  >
                    {savingDesign ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {t("Save", "حفظ")}
                  </button>
                  <button
                    onClick={() => setProductionDesignId("studio-current")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 text-sm font-bold"
                  >
                    <Factory size={15} /> {t("Produce", "تصنيع")}
                  </button>
                </div>

                {/* FitMockup-style action dock: one horizontal row of
                    labelled icons right under the Save/Produce buttons.
                    "Garments" comes first — entering the Studio opens it
                    automatically so you always start by picking the piece
                    you want to design on. */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {([
                    ["garments", t("Garments", "ملابس"), Shirt],
                    ["fit", t("Color", "اللون"), PaletteIcon],
                    ["paint", t("Paint", "رسم"), Brush],
                    ["bg", t("Background", "الخلفية"), ImageIcon],
                    ["layout", t("Mockups", "الموك اب"), LayoutGrid],
                    ["artwork", t("Edit", "تحرير"), Sticker],
                    ["ai", t("AI", "ذكاء"), Sparkles],
                  ] as const).map(([id, label, Icon]) => {
                    const active = studioPanel === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setStudioPanel(id)}
                        title={label}
                        className={`shrink-0 min-w-[70px] rounded-2xl px-3 py-2.5 flex flex-col items-center gap-1 border transition ${
                          active
                            ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-100 shadow-[0_0_18px_rgba(6,182,212,0.25)]"
                            : "bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/[0.07]"
                        }`}
                      >
                        <Icon size={18} />
                        <span className="text-[9px] font-bold">{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Garment picker INSIDE the studio — the entry point of the
                    design flow: entering the Studio tab lands here first,
                    choosing a piece opens the design panels automatically. */}
                {studioPanel === "garments" && (
                  <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shirt size={15} className="text-cyan-300" />
                      <span className="text-sm font-black">{t("Choose a garment", "اختر قطعة الملابس")}</span>
                      <span className="ml-auto text-[10px] text-white/40">
                        {t("Pick what suits you — the studio opens right after", "اختر الي يناسبك — يفتح لك الاستوديو بعدها مباشرة")}
                      </span>
                    </div>
                    <GarmentLibrary lang={lang} onPick={applyGarment} />
                  </div>
                )}

                {studioPanel === "paint" && (
                  <ProToolbar
                    brush={brush}
                    setBrush={(patch) => setBrush((b) => ({ ...b, ...patch }))}
                    palette={PALETTE}
                    frozen={frozen}
                    setFrozen={setFrozen}
                    onUploadImage={handleUploadImage}
                    onUndo={() => setUndoSignal((n) => n + 1)}
                    onClear={() => setClearSignal((n) => n + 1)}
                    lang={lang}
                  />
                )}

                {/* Background + motion (animation) properties */}
                {studioPanel === "bg" && (
                  <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1.5">{t("Background", "الخلفية")}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {["#000000", "#0b1020", "#14061f", "#1a1a1a", "#e8e4dd", "#ffffff", "#0c2340", "#1b4332"].map((c) => (
                          <button
                            key={c}
                            onClick={() => setStudioBg(c)}
                            className={`w-7 h-7 rounded-lg border-2 ${studioBg === c ? "border-cyan-400" : "border-white/15"}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1.5">{t("Animation", "الحركة")}</div>
                      <div className="flex gap-2">
                        {([
                          ["stand", t("Stand", "وقوف"), PersonStanding],
                          ["walk", t("Walk", "مشي"), Footprints],
                          ["wind", t("Wind", "رياح"), Wind],
                        ] as const).map(([id, label, Icon]) => (
                          <button
                            key={id}
                            onClick={() => setPose(id)}
                            className={`flex-1 py-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                              pose === id ? "bg-fuchsia-500/20 border-fuchsia-400/60 text-fuchsia-100" : "bg-white/[0.04] border-white/10 text-white/60"
                            }`}
                          >
                            <Icon size={16} />
                            <span className="text-[9px] font-bold">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-white/50 flex items-center gap-1">
                        <RotateCw size={11} /> {t("Turntable", "الدوران التلقائي")}
                      </span>
                      <button
                        onClick={() => setFrozen((f) => !f)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black border ${
                          frozen ? "bg-white/5 border-white/15 text-white/60" : "bg-cyan-500/20 border-cyan-400/60 text-cyan-100"
                        }`}
                      >
                        {frozen ? t("Off", "متوقف") : t("On", "يدور")}
                      </button>
                    </div>
                  </div>
                )}

                {/* 2D Mockup board — the four mockup squares (front / back /
                    sleeves), now real smooth direct-manipulation controls:
                    drag, resize and rotate artwork right on the mockup. The
                    purple button opens the full garment-parts picker, and
                    anything added lands here AND on the 3D garment above
                    (front/back) automatically. */}
                {studioPanel === "layout" && (
                  <MockupBoard2D
                    garment={garment}
                    color={color}
                    ar={lang === "ar"}
                    side={decalSide}
                    onSide={setDecalSide}
                    slots={mockupSlots}
                    onTransform={setMockupTransform}
                    onRemove={removeMockupArtwork}
                    onUpload={applyArtworkToSide}
                    onOpenParts={() => setPartsSheetOpen(true)}
                  />
                )}



                {studioPanel === "ai" && user && (
                  <AIGraphicAssistant
                    userId={user.id}
                    lang={lang}
                    onGenerated={(url) => { applyArtworkToSide(url); void refreshMissions(); }}
                  />
                )}

                {/* Front/back artwork — two real independent slots now:
                    each tab uploads and positions its own image, both are
                    baked onto the garment together with any hand-painted
                    strokes (see compose() in Studio3D.tsx). */}
                {studioPanel === "artwork" && (
                <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-2">
                  {/* Print / embroidery treatment — applies to the ACTIVE side's
                      artwork layer independently (front and back can differ).
                      Garment parts moved to the Layout panel, next to the
                      front/back sheets. */}
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
                      {t("Print / embroidery type", "نوع الطباعة / التطريز")}
                      <span className="text-white/25 normal-case tracking-normal">
                        {" "}({decalSide === "back" ? t("back", "الخلف") : t("front", "الأمام")})
                      </span>
                    </div>
                    {(["print", "embroidery"] as const).map((cat) => (
                      <div key={cat} className="mb-1.5">
                        <div className="text-[9px] text-white/30 mb-1">
                          {cat === "print" ? t("Ink & print", "أحبار وطباعة") : t("Embroidery & applied pieces", "تطريز وقطع مضافة")}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {DECORATION_TYPES.filter((d) => d.category === cat).map((d) => {
                            const active = (decalSide === "back" ? decorationTypeBack : decorationType) === d.id;
                            return (
                              <button
                                key={d.id}
                                title={lang === "ar" ? d.descriptionAr : d.description}
                                onClick={() => (decalSide === "back" ? setDecorationTypeBack(d.id) : setDecorationType(d.id))}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                  active ? "bg-cyan-400/20 border-cyan-400/60 text-cyan-200" : "bg-white/[0.04] border-white/10 text-white/60 hover:border-white/30"
                                }`}
                              >
                                <DecorationIcon id={d.id} />
                                {lang === "ar" ? d.ar : d.en}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>


                  <div className="flex rounded-xl border border-white/10 overflow-hidden text-[11px] font-bold">
                    {(["front", "back"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setDecalSide(s)}
                        className={`flex-1 py-1.5 flex items-center justify-center gap-1 transition ${
                          (decalSide === "back" ? "back" : "front") === s ? "bg-cyan-500/25 text-cyan-100" : "bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                        }`}
                      >
                        {s === "front" ? t("Front artwork", "رسمة أمامية") : t("Back artwork", "رسمة خلفية")}
                        {(s === "front" ? decalUrl : decalUrlBack) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </button>
                    ))}
                  </div>

                  {/* The old drag-pad ("تحكم مكان الصورة") is gone — placement
                      is direct manipulation on the 2D mockup board now
                      (Mockups tab). This panel just uploads / removes the
                      artwork of the selected side. */}
                  {(() => {
                    const onBack = decalSide === "back";
                    const url = onBack ? decalUrlBack : decalUrl;
                    return url ? (
                      <div className="flex items-center gap-2 rounded-xl bg-black/40 border border-white/10 p-2">
                        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                          <img src={url} alt="" className="w-full h-full object-contain" />
                        </div>
                        <span className="flex-1 text-[10px] text-white/50 leading-tight">
                          {t("Position it by dragging directly on the mockup (Mockups tab).", "حرّك مكان الرسمة بالسحب المباشر على الموك اب (تبويب الموك اب).")}
                        </span>
                        <button
                          onClick={() => { onBack ? setDecalUrlBack(null) : setDecalUrl(null); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-400/40 text-red-200 text-[10px] font-bold"
                        >
                          <Trash2 size={12} /> {t("Remove", "حذف")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => artworkFileRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 border-dashed border-white/15 text-white/40 hover:border-cyan-400/40 hover:text-cyan-300 transition"
                      >
                        <Upload size={20} />
                        <span className="text-[11px]">
                          {onBack
                            ? t("Upload artwork for the back — it prints on the back only.", "ارفع صورة للخلف — بتُطبع بالخلف بس.")
                            : t("Upload artwork for the front, or generate one with AI.", "ارفع صورة للأمام، أو ولّدها بالذكاء الاصطناعي.")}
                        </span>
                      </button>
                    );
                  })()}
                  <input
                    ref={artworkFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const reader = new FileReader();
                        reader.onload = () => applyArtworkToSide(String(reader.result));
                        reader.readAsDataURL(f);
                      }
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
                )}

                {studioPanel === "fit" && (
                <>
                <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-white/50 flex items-center gap-1">
                    <PaletteIcon size={11} /> {t("Base color", "لون القاعدة")}
                  </div>
                  <ColorPickerHSV color={color} onChange={changeColor} ar={lang === "ar"} />
                  <div className="flex flex-wrap gap-1.5">
                    {PALETTE.map((c) => (
                      <button key={c} onClick={() => changeColor(c)}
                        className={`w-6 h-6 rounded-md border-2 ${color.toLowerCase() === c.toLowerCase() ? "border-white" : "border-white/20"}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>

                </>
                )}

              </div>
            )}

            {tab === "arena" && (
              <div className="space-y-4">
                <ArenaHero
                  title={topic}
                  lang={lang}
                  onStart={() => setBattleActive(true)}
                />

                {battleActive && user && (
                  <BattleRoom
                    lang={lang}
                    userId={user.id}
                    username={profile?.username || user.email?.split("@")[0] || "Player"}
                    level={level}
                    topic={topic}
                    garment={garment}
                    color={color}
                    decalUrl={decalUrl}
                    decalTransform={decalTransform}
                    onEnterStudio={() => setTab("studio")}
                    onClose={() => { setBattleActive(false); void refreshMissions(); refreshProfile(); }}
                  />
                )}

                <CompetitorsRoom lang={lang} online={onlinePlayers} myUserId={user?.id} onOpenStudio={() => setTab("studio")} />

                <div className="rounded-xl p-3 bg-white/[0.02] border border-white/10 text-[11px] text-white/40 text-center">
                  {t("Prefer solo practice? Judge yourself against the community topic below, no matchmaking needed.", "تفضل التمرين الفردي؟ قيّم نفسك ضد موضوع المجتمع تحت، بدون مطابقة لاعبين.")}
                </div>
                <ArenaBoard
                  lang={lang}
                  garment={garment}
                  color={color}
                  topic={topic}
                  decalUrl={decalUrl}
                  getGarmentSnapshot={() => studioRef.current?.getSnapshotDataUrl() ?? null}
                  onTopic={setTopic}
                  onScore={(s) => { setUserScore(s); void refreshMissions(); }}
                  onTopRank={(rank) => {
                    grantXP(150, rank === 1 ? "Topic Winner" : "Topic Runner-up"); // one-off bonus popup only — level/xp itself is authoritative from the server (refreshMissions/getProgress), never mutated locally
                  }}
                />

              </div>
            )}

            {tab === "styles" && (
              <GarmentLibrary lang={lang} onPick={applyGarment} />
            )}

            {/* Reels open straight into the full-screen vertical player */}
            {tab === "feed" && <ShortsFeed lang={lang} />}

            {tab === "market" && (
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/40 text-amber-300 text-[10px] font-bold mb-2">
                  🏆 {t("$ZONE CLOTHING MARKETPLACE", "سوق ملابس ZONE$")}
                </span>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-2xl font-black">{t("Designer Marketplace & Royalties", "سوق المصممين والعمولات")}</h2>
                    <p className="text-xs text-white/50 mt-1 max-w-md">
                      {t(
                        "Trade exclusive 3D garments. Reaching Level 50 unlocks the Verified Badge (✓) & grants monetization privileges!",
                        "تداول ملابس ثلاثية الأبعاد حصرية. الوصول للمستوى 50 يفتح الشارة الموثقة (✓) ويمنح صلاحيات الربح!"
                      )}
                    </p>
                  </div>
                  {!verified && (
                    <div className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-[10px]">
                      <Lock size={14} className="text-white/40" />
                      <div>
                        <div className="font-bold text-white/70">{t("MONETIZATION LOCKED", "الربح مقفل")}</div>
                        <div className="text-white/40">
                          {t(`Level ${level}/50 to sell your own`, `المستوى ${level}/50 للبيع بنفسك`)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {verified && <MyShopCard userId={user!.id} lang={lang} />}

                {marketLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/40" size={24} /></div>
                ) : marketListings.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-10">
                    {t("Nothing listed yet — Level-50 designers can list their designs from the Studio's My Designs section.", "ما فيه تصاميم بالسوق بعد — المصممون بمستوى 50+ يقدرون يعرضون تصاميمهم من قسم تصاميمي بالبروفايل.")}
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {marketListings.map((item) => (
                      <div key={item.id} className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10">
                        <div
                          className="h-28 flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${item.color}, #000)` }}
                        >
                          {item.decal_url && <img src={item.decal_url} alt={item.title} className="max-h-[70%] max-w-[70%] object-contain" />}
                        </div>
                        <div className="p-3">
                          <div className="font-bold text-sm truncate">{item.title || item.garment}</div>
                          <div className="text-[11px] text-white/50">{item.seller_username}</div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-white/40 uppercase">{t("Price", "السعر")}</span>
                            <span className="text-amber-300 font-mono text-xs font-bold">${(item.price_cents / 100).toFixed(2)}</span>
                          </div>
                          <button
                            onClick={() => handleBuy(item)}
                            disabled={buyingId === item.id || item.user_id === user?.id}
                            className="mt-2 w-full py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 text-xs font-bold disabled:opacity-50"
                          >
                            {buyingId === item.id ? "..." : item.user_id === user?.id ? t("Yours", "تصميمك") : t("Buy", "شراء")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "ranks" && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Trophy className="text-yellow-400" />
                  <h2 className="text-2xl font-black">{t("Ranked Ladder", "سلم الرتب")}</h2>
                </div>
                <RankCards level={level} missionsCompleted={completedMissionIds.length} lang={lang} />

                <div className="mt-6 rounded-xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={14} className="text-yellow-400" />
                    <span className="text-sm font-black">{t("Top Players", "المتصدرون")}</span>
                  </div>
                  {leaderboardLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-white/40" size={20} /></div>
                  ) : topPlayers.length === 0 ? (
                    <p className="text-xs text-white/40 text-center py-4">
                      {t("No players yet — be the first!", "ما فيه لاعبين بعد — كن أول واحد!")}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {topPlayers.map((p, i) => {
                        const isMe = p.id === user?.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setViewingPlayer(p)}
                            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/[0.05] transition ${
                              isMe ? "bg-cyan-500/10 border border-cyan-400/30" : "bg-white/[0.02]"
                            }`}
                          >
                            <span className="w-5 text-center text-xs font-mono text-white/40">{i + 1}</span>
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-[10px] font-black text-black shrink-0">
                              {p.username[0]?.toUpperCase() ?? "?"}
                            </div>
                            <span className="flex-1 text-xs font-semibold truncate flex items-center gap-1.5">
                              {p.username} {isMe && <span className="text-cyan-300">({t("You", "أنت")})</span>}
                            </span>
                            <RankBadge level={p.level} lang={lang} />
                            <span className="text-[11px] font-mono text-fuchsia-300">{p.xp} XP</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Read-only public profile viewer — tap any player above.
                    Identity card sits on the trailing edge; the free space
                    next to it shows the person's published designs + bio,
                    unless their Privacy switch is ON. */}
                <Dialog open={Boolean(viewingPlayer)} onOpenChange={(o) => !o && setViewingPlayer(null)}>
                  <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-md sm:max-w-lg" dir={lang === "ar" ? "rtl" : "ltr"}>
                    {viewingPlayer && (
                      <>
                        <DialogHeader>
                          <DialogTitle className="sr-only">{viewingPlayer.username}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] items-start py-1">
                          {/* published designs + bio in the empty space */}
                          <div className="min-w-0 order-2 sm:order-1">
                            {viewedPrivate ? (
                              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                                <Shield size={18} className="mx-auto text-white/30" />
                                <p className="mt-2 text-[11px] text-white/40">
                                  {t("This profile is private — designs are hidden.", "هذا الحساب خاص — التصاميم مخفية.")}
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                                  {t("Published designs", "التصاميم المنشورة")}
                                </div>
                                {viewedDesigns.length === 0 ? (
                                  <p className="text-[11px] text-white/30">{t("No designs published yet.", "ما نشر أي تصميم بعد.")}</p>
                                ) : (
                                  <div className="grid grid-cols-3 gap-2">
                                    {viewedDesigns.slice(0, 9).map((d) => (
                                      <div key={d.id} className="aspect-square rounded-lg overflow-hidden border border-white/10" style={{ background: d.color }}>
                                        {d.decal_url && <img src={d.decal_url} alt={d.title} className="w-full h-full object-contain" />}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">{t("Bio", "النبذة")}</div>
                              <p className="text-[12px] text-white/70 break-words">
                                {viewedBio || t("No bio yet.", "ما فيه نبذة بعد.")}
                              </p>
                            </div>
                          </div>

                          {/* identity card, pushed to the trailing edge */}
                          <div className="order-1 sm:order-2 flex flex-col items-center text-center shrink-0 w-full sm:w-36 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 p-3">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-black font-black text-2xl mb-2">
                              {viewedAvatar ? <img src={viewedAvatar} alt="" onError={() => setViewedAvatar(null)} className="w-full h-full object-cover" /> : viewingPlayer.username[0]?.toUpperCase()}
                            </div>
                            <div className="font-black text-sm break-words">{viewingPlayer.username}</div>
                            <RankBadge level={viewingPlayer.level} lang={lang} size={14} />
                            <div className="text-[11px] text-white/40 mt-1">LVL {viewingPlayer.level} · {viewingPlayer.xp} XP</div>
                          </div>
                        </div>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
                <div className="mt-6 grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl p-4 bg-white/[0.03] border border-white/10">
                    <div className="text-xs text-white/50 uppercase mb-2">{t("Arena Record", "سجل الساحة")}</div>
                    <div className="flex items-baseline gap-4">
                      <div>
                        <div className="text-3xl font-black text-cyan-300">{missionStats?.battlesJudged ?? 0}</div>
                        <div className="text-[10px] text-white/40">{t("battles judged", "معركة محكومة")}</div>
                      </div>
                      <div>
                        <div className="text-3xl font-black text-amber-300">{missionStats?.highScoreEntries ?? 0}</div>
                        <div className="text-[10px] text-white/40">{t("scores 8.0+", "تقييم 8.0+")}</div>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/30 mt-2">
                      {t("Only the AI judge in the Arena sets your score — nothing here is self-reported.", "بس حكم الذكاء الاصطناعي بالساحة يحدد تقييمك — ولا شي هنا تقدر تحطه بنفسك.")}
                    </p>
                  </div>
                  <div className="rounded-xl p-4 bg-white/[0.03] border border-white/10">
                    <div className="text-xs text-white/50 uppercase mb-2">{t("Missions", "المهام")}</div>
                    <div className="text-3xl font-black text-fuchsia-300">{completedMissionIds.length}/{MISSIONS.length}</div>
                    <p className="text-[10px] text-white/30 mt-1">
                      {t("Complete missions to level up — see the full list below.", "أكمل المهام عشان ترتفع مستواك — شوف القائمة الكاملة تحت.")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="text-sm font-black mb-3">{t("Mission checklist", "قائمة المهام")}</div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {MISSIONS.filter((m) => m.minLevel <= level + 5).map((m) => {
                      const done = completedMissionIds.includes(m.id);
                      const locked = m.minLevel > level;
                      return (
                        <div key={m.id}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                            done ? "bg-emerald-500/10 border border-emerald-400/20" : locked ? "bg-white/[0.01] border border-white/5 opacity-40" : "bg-white/[0.02] border border-white/10"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {done ? <CheckCircle2 size={13} className="text-emerald-300" /> : locked ? <Lock size={13} className="text-white/30" /> : <Circle size={13} className="text-white/30" />}
                            {lang === "ar" ? m.titleAr : m.titleEn}
                            {locked && <span className="text-white/30">· LVL {m.minLevel}</span>}
                          </span>
                          {!done && <span className="text-cyan-300 font-mono">+{m.xp} XP</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === "profile" && (
              <div className="max-w-xl mx-auto space-y-4">
                <div className="rounded-2xl p-5 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 border border-white/10 text-center relative">
                  <button
                    onClick={() => setTab("ranks")}
                    title={t("Ranks", "الرتب")}
                    className="absolute top-3 left-3 w-9 h-9 rounded-xl bg-black/40 border border-amber-400/30 flex items-center justify-center text-amber-300 hover:bg-amber-500/10 transition"
                  >
                    <Trophy size={16} />
                  </button>

                  <label className="relative w-24 h-24 mx-auto block cursor-pointer group">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-4xl font-black text-black">
                      {avatarUrl ? <img src={avatarUrl} alt="" onError={() => setAvatarUrl(null)} className="w-full h-full object-cover" /> : profileName[0]}
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Camera size={20} className="text-white" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user) return;
                        const result = await uploadAvatar(user.id, file);
                        if (result.ok && result.url) { setAvatarUrl(result.url); refreshProfile(); toast.success(t("Profile photo updated", "تم تحديث صورة البروفايل")); }
                        else toast.error(result.message ?? t("Couldn't upload photo", "تعذّر رفع الصورة"));
                      }}
                    />
                  </label>

                  <div className="mt-3 text-2xl font-black flex items-center justify-center gap-2">
                    {profileName}
                    {verified && <span className="text-cyan-300 text-lg drop-shadow-[0_0_6px_currentColor]">✓</span>}
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">{profileBio}</p>
                  <div className="flex items-center justify-center gap-2 mt-1.5">
                    <span className="text-xs text-cyan-300 font-mono">LVL {level} · {coins} coins</span>
                    <RankBadge level={level} lang={lang} />
                  </div>

                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-cyan-400/30">
                    <span className="text-[10px] uppercase tracking-widest text-white/50">{t("Player ID", "معرّف اللاعب")}</span>
                    <span className="font-mono font-black text-cyan-200 text-sm select-all">#{playerId}</span>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(playerId); }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-100 font-bold"
                    >
                      {t("Copy", "نسخ")}
                    </button>
                  </div>

                  <div className="mt-4 pointer-events-none select-none opacity-95">
                    <XPBar level={level} xp={xp} xpToNext={xpToNext} popups={popups} />
                  </div>
                  <div className="mt-1 text-[10px] text-white/40">
                    {t("XP is earned through battles and missions only", "الخبرة تُكتسب من المعارك والمهام فقط")}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: t("Battles Judged", "معارك محكومة"), value: missionStats?.battlesJudged ?? 0 },
                    { label: t("Designs Created", "تصاميم أُنشئت"), value: myDesigns.length },
                    { label: t("Scores 8.0+", "تقييم 8.0+"), value: missionStats?.highScoreEntries ?? 0, star: true },
                    { label: t("ZONE Credits", "أرصدة ZONE"), value: coins },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl p-2.5 bg-white/[0.03] border border-white/10 text-center">
                      <div className="text-lg font-black text-cyan-200">{s.star && "★ "}{s.value}</div>
                      <div className="text-[9px] text-white/40 uppercase leading-tight mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* TikTok-style icon rail — one tap per section instead of
                    one long stacked scroll of cards. */}
                <div className="flex items-center justify-around border-y border-white/10 py-2">
                  {([
                    ["designs", t("Designs", "التصاميم"), Grid3x3],
                    ["plan", t("Plan", "الاشتراك"), Crown],
                    ["payouts", t("Payouts", "الأرباح"), CreditCard],
                    ["friends", t("Friends", "الأصدقاء"), Users],
                    ["settings", t("Settings", "الإعدادات"), SlidersHorizontal],
                  ] as const).map(([id, label, Icon]) => {
                    const active = profileTab === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setProfileTab(id)}
                        title={label}
                        aria-label={label}
                        className={`relative flex-1 flex flex-col items-center gap-1 py-1.5 transition ${
                          active ? "text-cyan-300" : "text-white/40 hover:text-white/70"
                        }`}
                      >
                        <Icon size={19} className={active ? "drop-shadow-[0_0_6px_currentColor]" : ""} />
                        {active && <span className="absolute -bottom-2 h-0.5 w-8 rounded-full bg-cyan-300" />}
                      </button>
                    );
                  })}
                </div>

                {profileTab === "designs" && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Save size={14} className="text-cyan-300" />
                    <span className="text-sm font-black">{t("My Designs", "تصاميمي")}</span>
                    <span className="text-[10px] text-white/40">({myDesigns.length})</span>
                  </div>
                  {designsLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-white/40" size={20} /></div>
                  ) : myDesigns.length === 0 ? (
                    <p className="text-xs text-white/40 text-center py-6">
                      {t("No saved designs yet — save one from the Studio tab.", "ما فيه تصاميم محفوظة بعد — احفظ واحد من تبويب الاستوديو.")}
                    </p>
                  ) : (
                    <>
                      {/* Instagram/TikTok-style tight square grid — tap a
                          tile to open the detail sheet with all the actions
                          (selling, deleting) instead of cramming tiny
                          controls into each thumbnail. */}
                      <div className="grid grid-cols-3 gap-0.5 sm:gap-1 rounded-lg overflow-hidden">
                        {myDesigns.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => setOpenDesign(d)}
                            className="relative aspect-square block group"
                            style={{ backgroundColor: d.color }}
                          >
                            {d.decal_url ? (
                              <img src={d.decal_url} alt={d.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Shirt size={28} className="text-white/20" />
                              </div>
                            )}
                            {d.decal_url_back && (
                              <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
                              </span>
                            )}
                            {d.for_sale && (
                              <span className="absolute top-1 right-1 px-1 py-0.5 rounded bg-emerald-500/90 text-black text-[8px] font-black">
                                ${(d.price_cents! / 100).toFixed(0)}
                              </span>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="text-[10px] font-bold text-white">{t("View", "عرض")}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Detail sheet — like tapping a post: full preview + actions */}
                      <Dialog open={Boolean(openDesign)} onOpenChange={(o) => !o && setOpenDesign(null)}>
                        <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-md sm:max-w-sm" dir={lang === "ar" ? "rtl" : "ltr"}>
                          {openDesign && (
                            <>
                              <DialogHeader>
                                <DialogTitle className="text-sm">{openDesign.title || `${openDesign.garment} · ${openDesign.size}`}</DialogTitle>
                              </DialogHeader>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="aspect-square rounded-xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: openDesign.color }}>
                                  {openDesign.decal_url ? <img src={openDesign.decal_url} className="w-full h-full object-cover" /> : <Shirt size={32} className="text-white/20" />}
                                </div>
                                <div className="aspect-square rounded-xl overflow-hidden flex items-center justify-center bg-white/[0.03] border border-white/10">
                                  {openDesign.decal_url_back ? (
                                    <img src={openDesign.decal_url_back} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] text-white/30 text-center px-3">{t("No back artwork", "لا يوجد رسمة خلفية")}</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-[11px] text-white/50 mt-1">{openDesign.garment} · {openDesign.size} · {new Date(openDesign.created_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</div>

                              {openDesign.for_sale ? (
                                <div className="flex items-center justify-between mt-2 rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-3 py-2">
                                  <span className="text-xs font-bold text-emerald-200">${(openDesign.price_cents! / 100).toFixed(0)} · {t("Listed", "معروض بالسوق")}</span>
                                  <button onClick={() => { handleUnlist(openDesign.id); setOpenDesign(null); }} className="text-[10px] text-red-300 underline">{t("Unlist", "سحب")}</button>
                                </div>
                              ) : verified ? (
                                <div className="flex gap-2 mt-2">
                                  <input
                                    type="number" min={1} placeholder={t("Price $", "السعر $")}
                                    value={sellPriceDraft[openDesign.id] ?? ""}
                                    onChange={(e) => setSellPriceDraft((s) => ({ ...s, [openDesign.id]: e.target.value }))}
                                    className="flex-1 rounded-lg bg-black/40 border border-white/10 text-xs px-2 py-1.5 text-white outline-none"
                                  />
                                  <button onClick={() => handleListForSale(openDesign.id)} className="px-3 rounded-lg bg-amber-500/80 text-black text-xs font-bold">
                                    {t("List for sale", "اعرض بالسوق")}
                                  </button>
                                </div>
                              ) : (
                                <p className="text-[10px] text-white/30 mt-2">{t("Reach Level 50 (or Elite) to sell your designs.", "وصّل مستوى 50 (أو اشترك Elite) عشان تبيع تصاميمك.")}</p>
                              )}

                              <button
                                onClick={() => setProductionDesignId(openDesign.id)}
                                disabled={requestingProductionId === openDesign.id}
                                className="mt-2 w-full py-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                <Factory size={12} /> {requestingProductionId === openDesign.id ? "…" : t("Request real-life production", "اطلب تصنيعه بالحقيقة")}
                              </button>

                              <button
                                onClick={() => { handleDeleteDesign(openDesign.id); setOpenDesign(null); }}
                                className="mt-2 w-full py-2 rounded-lg border border-red-400/30 text-red-300 text-xs font-bold flex items-center justify-center gap-1.5"
                              >
                                <Trash2 size={12} /> {t("Delete design", "حذف التصميم")}
                              </button>
                            </>
                          )}
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>

                )}

                {profileTab === "plan" && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Trophy size={14} className="text-amber-300" />
                      <span className="text-sm font-black">{t("Subscription", "الاشتراك")}</span>
                    </div>
                    {profile && profile.subscription_tier !== "free" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold uppercase">
                        {profile.subscription_tier}
                      </span>
                    )}
                  </div>

                  {/* While a paid plan is active the upgrade section is hidden
                      entirely — only the active-plan status stays. It returns
                      automatically once the paid period expires. */}
                  {hasActiveSub ? (
                    <button
                      onClick={() => setSubscribeDialogOpen(true)}
                      className="w-full flex items-center justify-between rounded-xl p-3 border border-emerald-400/30 bg-emerald-500/10"
                    >
                      <span className="text-xs font-bold text-emerald-200">
                        ✓ {t(`${(profile?.subscription_tier ?? "").toUpperCase()} plan active`, `خطتك ${profile?.subscription_tier} فعّالة`)}
                      </span>
                      <span className="text-[10px] text-emerald-300/70 underline">{t("Manage", "إدارة")}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setSubscribeDialogOpen(true)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-fuchsia-500/20 border border-amber-400/40 text-amber-200 text-xs font-black flex items-center justify-center gap-1.5"
                    >
                      <Crown size={13} /> {t("Upgrade your plan", "ترقية خطتك")}
                    </button>
                  )}


                  <Dialog open={subscribeDialogOpen} onOpenChange={setSubscribeDialogOpen}>
                    <DialogContent className="border-cyan-400/30 bg-black/95 backdrop-blur-md sm:max-w-md max-h-[85vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-400">
                          <Crown size={16} className="text-cyan-300" /> {t("Choose your plan", "اختر خطتك")}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="grid gap-2">
                        {(["basic", "pro", "elite"] as SubTier[]).map((tier) => {
                          const perks: Record<SubTier, string[]> = {
                            basic: [
                              t("Subscriber badge", "شارة مميزة"),
                              t("Arena priority queue", "أولوية دخول المعارك"),
                              t("+1 saved design slot boost", "مساحة إضافية لحفظ التصاميم"),
                            ],
                            pro: [
                              t("Everything in Basic", "كل شي بالأساسي"),
                              t("Exclusive Studio colors & materials", "ألوان وخامات حصرية بالاستوديو"),
                              t("Priority AI judging (faster queue)", "أولوية بتقييم الذكاء الاصطناعي"),
                              t("Instant verified checkmark ✔", "علامة توثيق فورية ✔"),
                              t(`Friends list — add up to ${FRIEND_LIMIT.pro} people (Clan)`, `قائمة أصدقاء — أضف حتى ${FRIEND_LIMIT.pro} أشخاص (كلان)`),
                            ],
                            elite: [
                              t("Everything in Pro", "كل شي بالبرو"),
                              t("Sell without Level 50", "بيع بدون شرط مستوى 50"),
                              t("Zero commission on sales", "بدون عمولة على مبيعاتك"),
                              t("Early access to new drops & features", "وصول مبكر للميزات الجديدة"),
                              t(`Bigger clan — up to ${FRIEND_LIMIT.elite} friends`, `كلان أكبر — حتى ${FRIEND_LIMIT.elite} صديق`),
                            ],
                          };
                          const isCurrent = profile?.subscription_tier === tier;
                          const rank = { basic: 1, pro: 2, elite: 3 }[tier];
                          const currentRank = { free: 0, basic: 1, pro: 2, elite: 3 }[profile?.subscription_tier ?? "free"];
                          return (
                            <div
                              key={tier}
                              className={`rounded-xl p-3 border ${isCurrent ? "border-emerald-400/50 bg-emerald-500/10" : "border-cyan-400/10 bg-gradient-to-br from-cyan-500/5 to-fuchsia-500/5"}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-black uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-300">{tier}</span>
                                <span className="text-cyan-200 font-mono text-xs font-bold">
                                  {currency === "USD"
                                    ? `$${(TIER_PRICES_CENTS[tier] / 100).toFixed(2)}`
                                    : formatMoney(convertUsdCentsToCurrency(TIER_PRICES_CENTS[tier], currency), currency)}
                                  <span className="text-white/40">/{t("mo", "شهر")}</span>
                                </span>
                              </div>
                              <ul className="text-[10px] text-white/50 space-y-0.5 mb-2 list-disc pr-4">
                                {perks[tier].map((p) => <li key={p}>{p}</li>)}
                              </ul>
                              {isCurrent ? (
                                <span className="block text-center text-[10px] font-bold text-emerald-300">
                                  ✓ {t("Active plan", "خطتك الحالية")}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSubscribe(tier)}
                                  disabled={subscribing === tier || currentRank >= rank}
                                  className="w-full py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/30 to-fuchsia-500/30 border border-cyan-400/40 text-cyan-100 text-[11px] font-bold disabled:opacity-40"
                                >
                                  {subscribing === tier ? "..." : t("Subscribe", "اشترك")}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {profile?.stripe_customer_id && (
                        <button
                          onClick={handleManageBilling}
                          className="mt-1 w-full py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white/70"
                        >
                          {t("Manage Subscription", "إدارة الاشتراك")}
                        </button>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>

                )}

                {profileTab === "payouts" && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={14} className="text-emerald-300" />
                    <span className="text-sm font-black">{t("Seller payouts", "استلام أرباح البيع")}</span>
                  </div>
                  <p className="text-[10px] text-white/50 mb-3">
                    {t(
                      "Connect a Stripe payout account to receive your share of marketplace sales directly. Elite subscribers keep 100% — everyone else keeps 85% (15% platform fee).",
                      "اربط حساب استلام أرباح على Stripe عشان تستلم حصتك من مبيعات السوق مباشرة. مشتركي Elite يحصلون 100%، والباقي 85% (عمولة المنصة 15%).",
                    )}
                  </p>
                  {profile?.stripe_connect_charges_enabled ? (
                    <span className="block text-center text-[10px] font-bold text-emerald-300">
                      ✓ {t("Payout account connected", "حساب الاستلام مربوط")}
                    </span>
                  ) : (
                    <button
                      onClick={handleConnectPayouts}
                      disabled={connecting}
                      className="w-full py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold disabled:opacity-40"
                    >
                      {connecting ? "..." : profile?.stripe_connect_account_id ? t("Finish payout setup", "أكمل إعداد الاستلام") : t("Connect payout account", "اربط حساب الاستلام")}
                    </button>
                  )}
                </div>

                )}

                {profileTab === "friends" && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-fuchsia-300" />
                      <span className="text-sm font-black">{t("Friends (Clan)", "الأصدقاء (كلان)")}</span>
                    </div>
                    <span className="text-[10px] text-white/40">{friends.length}/{FRIEND_LIMIT[profile?.subscription_tier ?? "free"] ?? 0}</span>
                  </div>

                  {(FRIEND_LIMIT[profile?.subscription_tier ?? "free"] ?? 0) === 0 ? (
                    <p className="text-[11px] text-white/40">
                      {t("Subscribe to Pro or Elite to unlock a friends list.", "اشترك ببرو أو إيليت عشان تفتح قائمة الأصدقاء.")}
                    </p>
                  ) : (
                    <>
                      <div className="flex gap-1.5 mb-2">
                        <input
                          value={friendIdInput}
                          onChange={(e) => setFriendIdInput(e.target.value)}
                          placeholder={t("Enter their Player ID (MZ-XXXXXX)", "أدخل معرّف اللاعب (MZ-XXXXXX)")}
                          className="flex-1 rounded-lg bg-black/40 border border-white/10 text-xs px-2.5 py-1.5 text-white outline-none focus:border-fuchsia-400/50"
                        />
                        <button
                          onClick={handleAddFriend}
                          disabled={addingFriend || !friendIdInput.trim()}
                          className="px-3 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-100 text-xs font-bold disabled:opacity-40"
                        >
                          {addingFriend ? "…" : t("Add", "إضافة")}
                        </button>
                      </div>
                      {friends.length === 0 ? (
                        <p className="text-[11px] text-white/30 text-center py-2">{t("No friends yet — add some by their Player ID.", "ما فيه أصدقاء بعد — أضف بمعرّف اللاعب.")}</p>
                      ) : (
                        <div className="space-y-1">
                          {friends.map((f) => (
                            <div key={f.id} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-[9px] font-black text-black overflow-hidden">
                                {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : f.username[0]?.toUpperCase()}
                              </div>
                              <span className="flex-1 text-xs font-semibold truncate">{f.username}</span>
                              <RankBadge level={f.level} lang={lang} size={10} />
                              <button onClick={() => handleRemoveFriend(f.id)} className="text-white/30 hover:text-red-300"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>


                )}

                {profileTab === "settings" && (
                <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings size={14} className="text-cyan-300" />
                    <span className="text-sm font-black">{t("Settings", "الإعدادات")}</span>
                  </div>
                  <SettingsPanel
                    lang={lang} setLang={setLang} quality={quality} setQuality={setQuality}
                    privacy={privacy} setPrivacy={changePrivacy} volume={volume} setVolume={setVolume}
                    visualizer={visualizer} setVisualizer={setVisualizer}
                    currency={currency} setCurrency={setCurrency}
                  />
                  <p className="mt-1 text-[10px] text-white/40">
                    {privacy
                      ? t("Privacy ON — visitors only see your name, level and bio.", "الخصوصية مفعّلة — الزوار يشوفون الاسم والمستوى والنبذة فقط.")
                      : t("Privacy OFF — visitors can also see your saved designs.", "الخصوصية معطّلة — الزوار يشوفون كذلك تصاميمك المحفوظة.")}
                  </p>

                  {/* Profile info now lives inside Settings instead of its own tab */}
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <User size={14} className="text-cyan-300" />
                      <span className="text-sm font-black">{t("Edit Profile Information", "تعديل معلومات البروفايل")}</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-white/40 uppercase">{t("Display Name", "اسم العرض")}</label>
                        <input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 uppercase">{t("Bio / Tagline", "نبذة")}</label>
                        <input
                          value={profileBio}
                          onChange={(e) => setProfileBio(e.target.value)}
                          className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => { updateProfile({ username: profileName, bio: profileBio }); toast.success(t("Profile saved", "تم حفظ البروفايل")); }}
                      className="mt-3 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-bold"
                    >
                      {t("Save Profile", "حفظ البروفايل")}
                    </button>
                    <button
                      onClick={() => signOut()}
                      className="mt-3 ms-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 text-xs font-bold"
                    >
                      {t("Sign Out", "تسجيل الخروج")}
                    </button>
                  </div>

                  <div className="mt-4 flex justify-center gap-4 text-[10px] text-white/40">
                    <Link to="/privacy" className="hover:text-cyan-300 hover:underline">{t("Privacy Policy", "سياسة الخصوصية")}</Link>
                    <span>·</span>
                    <Link to="/terms" className="hover:text-cyan-300 hover:underline">{t("Terms of Use", "شروط الاستخدام")}</Link>
                  </div>
                </div>
                )}
              </div>
            )}
          </section>

          <aside className="hidden lg:flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 min-h-0 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
              <AIDesignChat onApply={aiApply} lang={lang} />
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden flex flex-col max-h-[40%]">
              <div className="p-3 border-b border-white/10 flex items-center gap-2">
                <MessageSquare size={14} className="text-fuchsia-300" />
                <span className="text-xs font-bold uppercase tracking-widest">{t("Arena Chat", "دردشة الساحة")}</span>
              </div>
              <div className="flex-1 overflow-hidden"><ChatPanel /></div>
            </div>
          </aside>
        </div>
      </main>

      <button
        onClick={() => setAiOpen(true)}
        className="lg:hidden fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 shadow-[0_0_25px_rgba(217,70,239,0.6)] flex items-center justify-center"
        aria-label="Open AI stylist"
      >
        <Bot size={22} className="text-black" />
      </button>

      <AnimatePresence>
        {aiOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setAiOpen(false)} className="lg:hidden fixed inset-0 bg-black/70 z-50" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26 }}
              className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-black border-t border-white/10 rounded-t-3xl h-[80vh] flex flex-col">
              <div className="flex justify-between items-center p-3 border-b border-white/10">
                <span className="font-black text-sm">{t("AI Stylist", "المصمم الذكي")}</span>
                <button onClick={() => setAiOpen(false)}><X size={20} /></button>
              </div>
              <div className="flex-1 min-h-0">
                <AIDesignChat onApply={aiApply} lang={lang} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-black/90 backdrop-blur-xl border-t border-white/10 px-1 py-2 flex overflow-x-auto">
        {visibleNav.map((n) => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`flex-1 min-w-[54px] flex flex-col items-center gap-0.5 py-1 rounded-lg transition ${active ? "text-cyan-300" : "text-white/50"}`}>
              <Icon size={17} className={active ? "drop-shadow-[0_0_6px_currentColor]" : ""} />
              <span className="text-[9px] font-bold">{t(n.en, n.ar)}</span>
            </button>
          );
        })}
      </nav>

      <div className="fixed top-20 right-4 z-50 space-y-1 pointer-events-none">
        <AnimatePresence>
          {popups.map((p) => (
            <motion.div key={p.id}
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-xs font-bold shadow-lg">
              {p.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <ShippingAddressDialog
        open={Boolean(shippingListing)}
        lang={lang}
        busy={buyingId === shippingListing?.id}
        onCancel={() => setShippingListing(null)}
        onConfirm={handleConfirmPurchase}
      />

      <ProductionRequestDialog
        open={Boolean(productionDesignId)}
        lang={lang}
        busy={Boolean(requestingProductionId)}
        onCancel={() => setProductionDesignId(null)}
        onConfirm={handleRequestProduction}
      />
    </div>
  );
}

void Sparkles; void RANKS; void ShoppingBag;
