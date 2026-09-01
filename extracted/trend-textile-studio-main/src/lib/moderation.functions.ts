import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "./supabase";

/**
 * Content moderation: reporting, blocking, and (admin-only) hide/ban actions.
 * This exists because Google Play (and basic responsibility) requires any
 * app with user-generated content to have a working report → review →
 * remove pipeline — see supabase/migrations/007_moderation.sql for the
 * underlying tables/RLS.
 */

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key);
}

// ---------- Reporting (any signed-in user) ----------

const ReportInput = z.object({
  reporterId: z.string().uuid(),
  targetType: z.enum(["design", "arena_topic", "arena_entry", "user"]),
  targetId: z.string().uuid(),
  reason: z.enum(["sexual_content", "hate_or_harassment", "violence", "spam", "ip_violation", "other"]),
  details: z.string().max(1000).default(""),
});

export async function reportContent(input: z.infer<typeof ReportInput>): Promise<{ ok: boolean; message?: string }> {
  const data = ReportInput.parse(input);
  const { error } = await supabase.from("reports").insert({
    reporter_id: data.reporterId,
    target_type: data.targetType,
    target_id: data.targetId,
    reason: data.reason,
    details: data.details,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// ---------- Blocking (any signed-in user, client-side filtering) ----------

export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const { error } = await supabase.from("user_blocks").insert({ blocker_id: blockerId, blocked_id: blockedId });
  return !error;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  return !error;
}

export async function listBlockedIds(blockerId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", blockerId);
  if (error) return [];
  return (data ?? []).map((r) => r.blocked_id as string);
}

// ---------- Admin actions (server-only, checked against profiles.is_admin) ----------

async function assertAdmin(admin: ReturnType<typeof adminClient>, callerId: string) {
  const { data, error } = await admin.from("profiles").select("is_admin").eq("id", callerId).single();
  if (error || !data?.is_admin) throw new Error("Not authorized: admin only");
}

const AdminStatsInput = z.object({ callerId: z.string().uuid() });

/** Basic counts for the admin dashboard header — total users, banned
 *  users, open reports, and lifetime paid-order revenue. Intentionally
 *  simple (no charts/date-ranges) — a fuller analytics dashboard is a
 *  separate feature, this just gives an admin a sanity-check glance. */
export const getAdminStats = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AdminStatsInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    await assertAdmin(admin, data.callerId);

    const [{ count: totalUsers }, { count: bannedUsers }, { count: openReports }, { data: paidOrders }] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
      admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      admin.from("orders").select("price_cents").eq("status", "paid"),
    ]);

    const revenueCents = (paidOrders ?? []).reduce((sum, o) => sum + (o.price_cents ?? 0), 0);

    return {
      totalUsers: totalUsers ?? 0,
      bannedUsers: bannedUsers ?? 0,
      openReports: openReports ?? 0,
      paidOrderCount: paidOrders?.length ?? 0,
      revenueCents,
    };
  });

const OpenReportsInput = z.object({ callerId: z.string().uuid() });

/** Admin review queue: every open report, newest first. */
export const listOpenReports = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OpenReportsInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    await assertAdmin(admin, data.callerId);
    const { data: reports, error } = await admin
      .from("reports")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return reports;
  });

const ResolveReportInput = z.object({
  callerId: z.string().uuid(),
  reportId: z.string().uuid(),
  action: z.enum(["hide_content", "ban_user", "dismiss"]),
});

/**
 * Resolves a report: hides the offending content, bans the offending user,
 * or dismisses the report as unfounded. `hide_content` and `ban_user` are
 * separate choices on purpose — an admin can remove a single bad design
 * without banning the whole account.
 */
export const resolveReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ResolveReportInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    await assertAdmin(admin, data.callerId);

    const { data: report, error: reportErr } = await admin.from("reports").select("*").eq("id", data.reportId).single();
    if (reportErr || !report) throw new Error("Report not found");

    if (data.action === "hide_content" && report.target_type !== "user") {
      const table = report.target_type === "design" ? "designs" : report.target_type === "arena_topic" ? "arena_topics" : "arena_entries";
      const { error } = await admin.from(table).update({ is_hidden: true }).eq("id", report.target_id);
      if (error) throw new Error(error.message);
    }

    if (data.action === "ban_user") {
      // For a "user" report, target_id IS the user id. For content reports,
      // resolve the owning user first.
      let userId = report.target_id as string;
      if (report.target_type !== "user") {
        const table = report.target_type === "design" ? "designs" : report.target_type === "arena_topic" ? "arena_topics" : "arena_entries";
        const ownerCol = report.target_type === "design" ? "user_id" : report.target_type === "arena_topic" ? "author_id" : "user_id";
        const { data: owner } = await admin.from(table).select(ownerCol).eq("id", report.target_id).single();
        userId = (owner as Record<string, string> | null)?.[ownerCol] ?? userId;
      }
      const { error } = await admin.from("profiles").update({ is_banned: true, banned_reason: `Report ${report.id}: ${report.reason}` }).eq("id", userId);
      if (error) throw new Error(error.message);
    }

    const { error: updateErr } = await admin
      .from("reports")
      .update({ status: data.action === "dismiss" ? "dismissed" : "actioned", reviewed_by: data.callerId, reviewed_at: new Date().toISOString() })
      .eq("id", data.reportId);
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  });
