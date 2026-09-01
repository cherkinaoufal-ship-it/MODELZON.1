// Re-export the single generated Supabase client. Creating a SECOND GoTrue
// client with the same storage key in the same page deadlocks the auth lock,
// which left the app stuck on its loading spinner forever ("page doesn't load").
export { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  level: number;
  xp: number;
  coins: number;
  score: number;
  missions: number;
  lang: "ar" | "en";
  subscription_tier: "free" | "basic" | "pro" | "elite";
  subscription_source: "stripe" | "revenuecat_android" | "revenuecat_ios" | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_renews_at: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean;
  stripe_connect_payouts_enabled: boolean;
  is_private: boolean;
  is_admin: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  created_at: string;
  updated_at: string;
};
