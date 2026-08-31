import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { listOpenReports, resolveReport, getAdminStats } from "@/lib/moderation.functions";
import { ShieldAlert, Ban, EyeOff, Check, Users, DollarSign, Flag, UserX } from "lucide-react";

export const Route = createFileRoute("/admin/moderation")({
  component: ModerationAdminPage,
});

type Report = {
  id: string;
  reporter_id: string;
  target_type: "design" | "arena_topic" | "arena_entry" | "user";
  target_id: string;
  reason: string;
  details: string;
  created_at: string;
};

/**
 * Minimal admin review queue for reports filed via the in-app report
 * button (see moderation.functions.ts / 007_moderation.sql). Access is
 * gated by profiles.is_admin, checked server-side on every action — this
 * page itself doesn't need route-level auth because the underlying server
 * functions reject non-admins regardless of what the UI shows.
 */
function ModerationAdminPage() {
  const { user, profile, loading } = useAuth();
  const listFn = useServerFn(listOpenReports);
  const resolveFn = useServerFn(resolveReport);
  const statsFn = useServerFn(getAdminStats);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<{ totalUsers: number; bannedUsers: number; openReports: number; paidOrderCount: number; revenueCents: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [data, s] = await Promise.all([listFn({ data: { callerId: user.id } }), statsFn({ data: { callerId: user.id } })]);
      setReports(data as Report[]);
      setStats(s);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load reports");
    }
  }, [user, listFn, statsFn]);

  useEffect(() => {
    if (user && profile?.is_admin) void refresh();
  }, [user, profile?.is_admin, refresh]);

  const act = async (reportId: string, action: "hide_content" | "ban_user" | "dismiss") => {
    if (!user) return;
    setBusyId(reportId);
    try {
      await resolveFn({ data: { callerId: user.id, reportId, action } });
      setReports((rs) => rs.filter((r) => r.id !== reportId));
    } catch (e: any) {
      setError(e?.message ?? "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">…</div>;

  if (!user || !profile?.is_admin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 text-center">
        <div>
          <ShieldAlert className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-white/70">Admins only. Ask an existing admin to set your profiles.is_admin flag.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 mb-6">
          <ShieldAlert className="text-amber-300" />
          <h1 className="text-xl font-black">Moderation Queue</h1>
          <span className="text-xs text-white/40">({reports.length} open)</span>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <Users size={14} className="text-cyan-300 mb-1" />
              <div className="text-lg font-black">{stats.totalUsers}</div>
              <div className="text-[10px] text-white/40">Total users</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <UserX size={14} className="text-red-300 mb-1" />
              <div className="text-lg font-black">{stats.bannedUsers}</div>
              <div className="text-[10px] text-white/40">Banned</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <Flag size={14} className="text-amber-300 mb-1" />
              <div className="text-lg font-black">{stats.openReports}</div>
              <div className="text-[10px] text-white/40">Open reports</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <DollarSign size={14} className="text-emerald-300 mb-1" />
              <div className="text-lg font-black">${(stats.revenueCents / 100).toFixed(0)}</div>
              <div className="text-[10px] text-white/40">{stats.paidOrderCount} paid orders</div>
            </div>
          </div>
        )}

        {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

        {reports.length === 0 ? (
          <p className="text-white/40 text-sm">No open reports 🎉</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase text-cyan-300">{r.target_type}</span>
                  <span className="text-[10px] text-white/40">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm mb-1">
                  <span className="font-bold">{r.reason}</span>
                  {r.details && <span className="text-white/60"> — {r.details}</span>}
                </p>
                <p className="text-[10px] text-white/30 mb-3">target: {r.target_id}</p>
                <div className="flex gap-2">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "hide_content")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold disabled:opacity-40"
                  >
                    <EyeOff size={12} /> Hide content
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "ban_user")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-400/40 text-red-200 text-xs font-bold disabled:opacity-40"
                  >
                    <Ban size={12} /> Ban user
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "dismiss")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-bold disabled:opacity-40"
                  >
                    <Check size={12} /> Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
