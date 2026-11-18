"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AREA_REVIEW_PAGE_SIZE,
  MAX_AREA_REVIEW_LENGTH,
  type AreaReview,
  type AreaReviewsPage,
} from "@/features/area/reviews";

type Props = {
  localityName: string;
};

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate" },
  { value: "spam", label: "Spam" },
  { value: "personal-information", label: "Personal information" },
  { value: "violence", label: "Violence" },
  { value: "other", label: "Other" },
] as const;

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[var(--accent-yellow)]"
      aria-label={`Rated ${rating} out of 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill={index < rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3.6l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.62 6.9 19.3l.98-5.68L3.75 9.6l5.7-.83L12 3.6z" />
        </svg>
      ))}
    </span>
  );
}

export function AreaReviews({ localityName }: Props) {
  const [reviews, setReviews] = useState<AreaReview[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [reportTarget, setReportTarget] = useState<AreaReview | null>(null);
  const [reportReason, setReportReason] = useState<string>("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPage = useCallback(async (cursor: string | null, mode: "initial" | "more") => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (mode === "initial") setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ scope: "locality" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/area/reviews?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as Partial<AreaReviewsPage> & {
        error?: string;
      };
      if (!mountedRef.current) return;
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not load reviews.");
        return;
      }
      const incoming = json.reviews ?? [];
      setReviews((current) => {
        if (mode === "more") {
          const seen = new Set(current.map((review) => review.id));
          return [...current, ...incoming.filter((review) => !seen.has(review.id))];
        }
        return incoming;
      });
      setNextCursor(json.nextCursor ?? null);
    } catch {
      if (!mountedRef.current) return;
      setError("Could not load reviews. Check your connection and try again.");
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void fetchPage(null, "initial"), 0);
    return () => window.clearTimeout(id);
  }, [fetchPage]);

  const myReview = reviews.find((review) => review.isMine) ?? null;

  function beginComposer() {
    setFormError(null);
    setNotice(null);
    setDraft(myReview?.body ?? "");
    setComposerOpen(true);
  }

  async function submitReview() {
    const body = draft.trim();
    if (!body) {
      setFormError("Write a review before posting.");
      return;
    }
    if (body.length > MAX_AREA_REVIEW_LENGTH) {
      setFormError(`Reviews can be up to ${MAX_AREA_REVIEW_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/area/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "locality", body }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        review?: AreaReview;
        error?: string;
      };
      if (!res.ok) {
        setFormError(typeof json.error === "string" ? json.error : "Could not save your review.");
        return;
      }
      const review = json.review;
      if (!review) {
        setFormError("Could not save your review. Please try again.");
        return;
      }
      const existed = reviews.some((item) => item.id === review.id || item.isMine);
      setComposerOpen(false);
      setNotice(existed ? "Your review was updated." : "Your review was posted.");
      void fetchPage(null, "initial");
    } catch {
      setFormError("Could not save your review. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function submitReport() {
    if (!reportTarget) return;
    setReportBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "review",
          targetId: reportTarget.id,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotice(typeof json.error === "string" ? json.error : "Could not submit the report.");
        return;
      }
      setReportTarget(null);
      setReportDetails("");
      setReportReason("harassment");
      setNotice("Report submitted.");
    } catch {
      setNotice("Could not submit the report. Check your connection and try again.");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <div className="mt-3 pb-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] text-[var(--body-text)]">Reviews for {localityName}</p>
          <p className="mt-0.5 text-[11px] tracking-[0.2px] text-[var(--mute)]">
            One review per area. Your handle stays a ghost name.
          </p>
        </div>
        {!composerOpen ? (
          <button type="button" className="btn btn-sm btn-secondary flex-none" onClick={beginComposer}>
            {myReview ? "Edit your review" : "Write a review"}
          </button>
        ) : null}
      </div>

      {notice ? (
        <p
          className="mt-2 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-2 text-[12px] text-[var(--body-text)]"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {composerOpen ? (
        <form
          className="mt-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitReview();
          }}
        >
          <label htmlFor="area-review-body" className="text-[11px] uppercase tracking-[0.4px] text-[var(--ash)]">
            {myReview ? "Edit your review" : "Write a review"}
          </label>
          <textarea
            id="area-review-body"
            className="field mt-1.5 min-h-[96px] resize-y"
            maxLength={MAX_AREA_REVIEW_LENGTH}
            rows={4}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What is it like to live or spend time in this area?"
          />
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] tracking-[0.2px] text-[var(--ash)]">
            <span>Submitting again updates your existing review.</span>
            <span className="tabular-nums">
              {draft.length}/{MAX_AREA_REVIEW_LENGTH}
            </span>
          </div>
          {formError ? (
            <p className="mt-2 text-[12px] text-[var(--accent-red)]" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-sm btn-tertiary"
              onClick={() => setComposerOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
              {saving ? "Saving..." : myReview ? "Update review" : "Post review"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="mt-3 space-y-2" role="status" aria-label="Loading reviews">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface-elevated)]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[rgba(255,97,97,0.28)] bg-[var(--accent-red-soft)] px-3 py-2 text-[13px] text-[var(--accent-red)]" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="btn btn-sm btn-tertiary mt-2"
            onClick={() => void fetchPage(null, "initial")}
          >
            Try again
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-4 py-8 text-center">
          <p className="text-[14px] text-[var(--ink)]">No reviews yet</p>
          <p className="mt-1 text-[12px] tracking-[0.2px] text-[var(--mute)]">
            Share what this area is like and help your neighbours.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {reviews.map((review) => {
            const mine = review.isMine;
            return (
              <li
                key={review.id}
                className={`rounded-[var(--radius-lg)] border bg-[var(--surface)] p-3 ${
                  mine ? "border-[var(--hairline-strong)]" : "border-[var(--hairline)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tracking-[0.3px] text-[var(--ash)]">
                      <span className="font-medium text-[var(--mute)]">{review.handle}</span>
                      {mine ? <span className="badge">Your review</span> : null}
                      {review.edited ? <span>· edited</span> : null}
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatWhen(review.createdAt)}</span>
                    </p>
                    {review.rating !== null ? (
                      <div className="mt-1">
                        <ReviewStars rating={review.rating} />
                      </div>
                    ) : null}
                  </div>
                  {!mine ? (
                    <button
                      type="button"
                      className="flex-none text-[11px] tracking-[0.2px] text-[var(--ash)] underline underline-offset-2 transition-colors hover:text-[var(--ink)]"
                      onClick={() => {
                        setReportTarget(review);
                        setReportDetails("");
                        setReportReason("harassment");
                      }}
                    >
                      Report
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--body-text)]">
                  {review.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && !loading ? (
        <button
          type="button"
          className="btn btn-sm btn-secondary mt-3 w-full"
          onClick={() => void fetchPage(nextCursor, "more")}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading more reviews..." : "Load more reviews"}
        </button>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed tracking-[0.2px] text-[var(--ash)]">
        Showing up to {AREA_REVIEW_PAGE_SIZE} reviews at a time, newest first.
      </p>

      {reportTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Report review"
        >
          <div className="w-full max-w-md rounded-t-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-5 pb-[max(env(safe-area-inset-bottom),20px)] sm:rounded-[var(--radius-xl)]">
            <h3 className="text-h3">Report review</h3>
            <p className="mt-1 text-[13px] text-[var(--mute)]">
              Reports help keep area reviews useful. Only include details needed to review this
              review.
            </p>
            <label className="mt-3 block text-[11px] uppercase tracking-[0.4px] text-[var(--mute)]">
              Reason
              <select
                className="field mt-1"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
              >
                {REPORT_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-[11px] uppercase tracking-[0.4px] text-[var(--mute)]">
              Details (optional)
              <textarea
                className="field mt-1"
                rows={3}
                maxLength={500}
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReportTarget(null)}
                disabled={reportBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submitReport()}
                disabled={reportBusy}
              >
                {reportBusy ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
