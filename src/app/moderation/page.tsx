"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Flag,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type Analytics = {
  total: number;
  open: number;
  reviewed: number;
  actioned: number;
  byReason: Record<string, number>;
  byType: Record<string, number>;
};

type Report = {
  id: string;
  type: "post" | "comment" | "message";
  targetId: string;
  targetContent: string;
  reason: string;
  details: string;
  status: "open" | "reviewed" | "actioned";
  created_at: string;
};

type Payload = {
  isModerator: boolean;
  reports: Report[];
  analytics: Analytics;
};

const REASON_LABELS: Record<string, string> = {
  harassment: "Harassment",
  hate: "Hate",
  spam: "Spam",
  "personal-information": "Personal info",
  violence: "Violence",
  other: "Other",
};

const TYPE_LABELS: Record<Report["type"], string> = {
  post: "Post",
  comment: "Comment",
  message: "Chat message",
};

const STATUS_FILTERS = ["open", "reviewed", "actioned", "all"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_LABELS: Record<StatusFilter, string> = {
  open: "Open",
  reviewed: "Reviewed",
  actioned: "Actioned",
  all: "All",
};

export default function ModerationPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load reports.");
      const json = (await res.json()) as Payload;
      setData(json);
      setError(null);
    } catch {
      setError("Could not load the moderation queue. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.reports.filter((report) => {
      if (statusFilter !== "all" && report.status !== statusFilter) return false;
      if (reasonFilter !== "all" && report.reason !== reasonFilter) return false;
      return true;
    });
  }, [data, statusFilter, reasonFilter]);

  async function updateStatus(report: Report, status: "reviewed" | "actioned") {
    setUpdating(report.id);
    setNotice(null);
    try {
      const res = await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: report.id, status }),
      });
      if (!res.ok) throw new Error("Could not update that report.");
      setNotice(status === "actioned" ? "Report marked as actioned." : "Report marked as reviewed.");
      await load();
    } catch {
      setError("Could not update that report. Please try again.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[var(--canvas)]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-white/8 backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-3 py-2.5 pt-[max(env(safe-area-inset-top),10px)] sm:px-5">
          <Link href="/home" className="btn btn-icon btn-secondary text-white/80" aria-label="Back to home">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent-green)]" strokeWidth={1.8} aria-hidden="true" />
            <h1 className="text-sm font-medium tracking-[0.2px] text-[var(--ink)]">Moderation</h1>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-secondary text-white/80"
            aria-label="Refresh reports"
            onClick={() => void load()}
          >
            <RefreshCw className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
        {loading ? (
          <div className="space-y-3" aria-label="Loading moderation queue" role="status">
            <div className="card space-y-3 p-5">
              <div className="h-3 w-28 rounded bg-white/8" />
              <div className="h-8 w-2/3 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/8" />
            </div>
            {[1, 2].map((item) => (
              <div key={item} className="card space-y-3 p-5">
                <div className="h-3 w-24 rounded bg-white/8" />
                <div className="h-3 w-full rounded bg-white/8" />
                <div className="h-3 w-4/5 rounded bg-white/8" />
              </div>
            ))}
          </div>
        ) : data && !data.isModerator ? (
          <section className="card px-5 py-12 text-center">
            <span className="app-tile mx-auto mb-4 h-12 w-12 text-[var(--accent-yellow)]">
              <Shield className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h2 className="text-h3">Moderator access only</h2>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--mute)]">
              This queue is limited to moderators and admins. If you should have access, ask an admin to add the role to your account.
            </p>
            <Link href="/home" className="btn btn-primary mx-auto mt-5">
              Back to home
            </Link>
          </section>
        ) : data ? (
          <div className="space-y-4">
            <section>
              <p className="text-label">Report reasons</p>
              <h2 className="mt-1 text-h2">Flagged content</h2>
              <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-[var(--mute)]">
                Review reports by reason and status. Content previews are shown without reporter identity.
              </p>
            </section>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <MetricCard label="Open" value={data.analytics.open} icon={<Flag className="h-3.5 w-3.5" strokeWidth={1.8} />} tone="yellow" />
              <MetricCard label="Reviewed" value={data.analytics.reviewed} icon={<CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />} tone="blue" />
              <MetricCard label="Actioned" value={data.analytics.actioned} icon={<XCircle className="h-3.5 w-3.5" strokeWidth={1.8} />} tone="red" />
              <MetricCard label="Total" value={data.analytics.total} icon={<ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />} tone="green" />
            </div>

            <section className="card p-4">
              <h3 className="text-label mb-3">Reasons at a glance</h3>
              {data.analytics.total === 0 ? (
                <p className="text-[13px] text-[var(--mute)]">No reports yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(data.analytics.byReason)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, count]) => (
                      <div key={reason}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                          <span className="text-[var(--body-text)]">{REASON_LABELS[reason] ?? reason}</span>
                          <span className="tabular-nums text-[var(--mute)]">{count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--accent-yellow)] to-[var(--accent-red)]"
                            style={{ width: `${Math.max(6, (count / data.analytics.total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
                {STATUS_FILTERS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={statusFilter === status}
                    className={`topic-chip flex-none ${statusFilter === status ? "topic-chip--active" : "topic-chip--inactive"}`}
                    onClick={() => setStatusFilter(status)}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
              <label className="block text-[11px] uppercase tracking-[0.4px] text-[var(--mute)]">
                Reason
                <select
                  className="field mt-1 text-white"
                  value={reasonFilter}
                  onChange={(event) => setReasonFilter(event.target.value)}
                >
                  <option value="all" className="bg-[#141416] text-white">
                    All reasons
                  </option>
                  {Object.keys(REASON_LABELS).map((reason) => (
                    <option key={reason} value={reason} className="bg-[#141416] text-white">
                      {REASON_LABELS[reason]}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            {notice ? (
              <p className="rounded-[var(--radius-md)] border border-[rgba(89,212,153,0.28)] bg-[var(--accent-green-soft)] p-3 text-[13px] text-[var(--accent-green)]" role="status">
                {notice}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-[var(--radius-md)] border border-[rgba(255,97,97,0.28)] bg-[var(--accent-red-soft)] p-3 text-[13px] text-[var(--accent-red)]" role="alert">
                {error}
              </p>
            ) : null}

            {filtered.length === 0 ? (
              <div className="card px-5 py-10 text-center">
                <span className="app-tile mx-auto mb-4 h-11 w-11 text-[var(--mute)]">
                  <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <p className="text-[15px] font-medium text-[var(--ink)]">Nothing in this view</p>
                <p className="mt-1 text-[13px] text-[var(--mute)]">
                  Try another status or reason, or check again later.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((report) => (
                  <article key={report.id} className="card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tag-chip !px-2 !py-0.5">{TYPE_LABELS[report.type]}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-yellow-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-yellow)]">
                        <AlertTriangle className="h-3 w-3" strokeWidth={1.8} />
                        {REASON_LABELS[report.reason] ?? report.reason}
                      </span>
                      <StatusBadge status={report.status} />
                      <span className="ml-auto text-[11px] text-[var(--ash)]">
                        {new Date(report.created_at).toLocaleString()}
                      </span>
                    </div>

                    {report.targetContent ? (
                      <blockquote className="mt-3 rounded-[var(--radius-md)] border-l-2 border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-[13px] leading-relaxed text-[var(--body-text)]">
                        {report.targetContent}
                      </blockquote>
                    ) : (
                      <p className="mt-3 text-[12px] italic text-[var(--ash)]">Content preview not available.</p>
                    )}

                    {report.details ? (
                      <p className="mt-2 text-[12px] leading-relaxed text-[var(--mute)]">
                        Reporter note: {report.details}
                      </p>
                    ) : null}

                    <p className="mt-2 truncate font-mono text-[10px] text-[var(--stone)]">Target {report.targetId}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-tertiary"
                        disabled={report.status === "reviewed" || updating === report.id}
                        onClick={() => void updateStatus(report, "reviewed")}
                      >
                        {updating === report.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        )}
                        Mark reviewed
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={report.status === "actioned" || updating === report.id}
                        onClick={() => void updateStatus(report, "actioned")}
                      >
                        {updating === report.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                        )}
                        Action taken
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "yellow" | "blue" | "red" | "green";
}) {
  const toneClass = {
    yellow: "bg-[var(--accent-yellow-soft)] text-[var(--accent-yellow)]",
    blue: "bg-[var(--accent-blue-soft)] text-[var(--accent-blue)]",
    red: "bg-[var(--accent-red-soft)] text-[var(--accent-red)]",
    green: "bg-[var(--accent-green-soft)] text-[var(--accent-green)]",
  }[tone];

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] p-3">
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${toneClass}`}>{icon}</span>
      <p className="mt-2 text-[20px] font-semibold tabular-nums leading-none text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.3px] text-[var(--mute)]">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: Report["status"] }) {
  if (status === "actioned") {
    return <span className="badge badge-danger">Actioned</span>;
  }
  if (status === "reviewed") {
    return <span className="badge badge-success">Reviewed</span>;
  }
  return <span className="badge badge-info">Open</span>;
}
