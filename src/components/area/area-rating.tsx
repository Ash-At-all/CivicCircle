"use client";

import { useCallback, useEffect, useState } from "react";
import type { AreaScope } from "@/features/area/chat";
import {
  AREA_RATING_MAX,
  AREA_RATING_MIN,
  type AreaRatingSummary,
} from "@/features/area/rating";

type Props = {
  scope?: AreaScope;
  onRated?: (summary: AreaRatingSummary) => void;
};

function StarIcon({ filled, className = "" }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.6l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.62 6.9 19.3l.98-5.68L3.75 9.6l5.7-.83L12 3.6z" />
    </svg>
  );
}

function AverageStars({ average }: { average: number }) {
  const percent = Math.max(0, Math.min(100, (average / AREA_RATING_MAX) * 100));
  return (
    <span className="relative inline-flex" aria-hidden="true">
      <span className="flex gap-0.5 text-[var(--stone)]">
        {Array.from({ length: AREA_RATING_MAX }, (_, index) => (
          <StarIcon key={index} filled={false} className="h-4 w-4" />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden text-[var(--accent-yellow)]"
        style={{ width: `${percent}%` }}
      >
        <span className="flex gap-0.5">
          {Array.from({ length: AREA_RATING_MAX }, (_, index) => (
            <StarIcon key={index} filled className="h-4 w-4 flex-none" />
          ))}
        </span>
      </span>
    </span>
  );
}

export function AreaRating({ scope = "locality", onRated }: Props) {
  const [summary, setSummary] = useState<AreaRatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/area/rating?scope=${encodeURIComponent(scope)}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as Partial<AreaRatingSummary> & {
        error?: string;
      };
      if (!res.ok) {
        setSummary(null);
        setError(typeof json.error === "string" ? json.error : "Could not load area ratings.");
        return;
      }
      setSummary(json as AreaRatingSummary);
    } catch {
      setSummary(null);
      setError("Could not load area ratings. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function submitRating(rating: number) {
    if (saving || summary?.myRating === rating) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/area/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, rating }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<AreaRatingSummary> & {
        error?: string;
      };
      if (!res.ok) {
        setNotice(typeof json.error === "string" ? json.error : "Could not save your rating.");
        return;
      }
      const next = json as AreaRatingSummary;
      setSummary(next);
      setNotice(next.myRating ? `Your rating: ${next.myRating} of ${AREA_RATING_MAX}.` : null);
      onRated?.(next);
    } catch {
      setNotice("Could not save your rating. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const activeValue = hovered ?? summary?.myRating ?? 0;
  const count = summary?.count ?? 0;
  const average = summary ? summary.average : null;

  return (
    <section
      aria-label="Area rating"
      className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.4px] text-[var(--ash)]">Area rating</p>
          {loading ? (
            <div className="mt-2 space-y-1.5" role="status" aria-label="Loading area rating">
              <div className="h-6 w-24 animate-pulse rounded bg-[var(--surface-card)]" />
              <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-card)]" />
            </div>
          ) : error ? (
            <div className="mt-1.5">
              <p className="text-[13px] text-[var(--accent-red)]" role="alert">
                {error}
              </p>
              <button type="button" className="btn btn-sm btn-tertiary mt-2" onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : average === null ? (
            <div className="mt-1.5">
              <p className="text-[14px] font-medium text-[var(--ink)]">No ratings yet</p>
              <p className="text-[12px] tracking-[0.2px] text-[var(--mute)]">
                Be the first to rate this area.
              </p>
            </div>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[22px] font-semibold leading-none tracking-[-0.3px] text-[var(--ink)] tabular-nums">
                {average.toFixed(1)}
              </span>
              <AverageStars average={average} />
              <span className="text-[12px] tracking-[0.2px] text-[var(--mute)]">
                {count} {count === 1 ? "rating" : "ratings"}
              </span>
            </div>
          )}
        </div>

        {!loading && !error ? (
          <div className="flex flex-none flex-col items-end gap-1">
            <div
              className="flex items-center gap-0.5"
              role="group"
              aria-label="Rate this area from 1 to 5 stars"
              onMouseLeave={() => setHovered(null)}
            >
              {Array.from({ length: AREA_RATING_MAX }, (_, index) => {
                const value = index + 1;
                const filled = value <= activeValue;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed ${
                      filled
                        ? "text-[var(--accent-yellow)]"
                        : "text-[var(--stone)] hover:text-[var(--mute)]"
                    }`}
                    aria-label={`Rate ${value} out of ${AREA_RATING_MAX}`}
                    aria-pressed={summary?.myRating === value}
                    disabled={saving}
                    onMouseEnter={() => setHovered(value)}
                    onFocus={() => setHovered(value)}
                    onBlur={() => setHovered(null)}
                    onClick={() => void submitRating(value)}
                  >
                    <StarIcon filled={filled} className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
            <p className="pr-1 text-[11px] tracking-[0.2px] text-[var(--ash)]">
              {saving
                ? "Saving..."
                : summary?.myRating
                  ? `You rated ${summary.myRating}`
                  : `Rate ${AREA_RATING_MIN} to ${AREA_RATING_MAX}`}
            </p>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p className="mt-2 text-[12px] leading-relaxed tracking-[0.2px] text-[var(--body-text)]" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
