"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, MessageSquareText, ChevronDown, Loader2 } from "lucide-react";
import { SaveShopButton } from "@/components/saved/save-shop-button";
import { formatDistance, sourceLabel } from "@/features/shops/format";
import { SHOP_CATEGORY_LABELS, type ShopCategory } from "@/features/shops/categories";
import {
  MAX_SHOP_REVIEW_LENGTH,
  SHOP_RATING_MAX,
  SHOP_RATING_MIN,
  type ShopRatingSummary,
  type ShopReview,
  type ShopReviewsPage,
} from "@/features/shops/reviews";
import type { NearbyShop } from "@/features/shops/types";

export type ShopLanguage = "en" | "hi";

const ISSUE_OPTIONS = [
  "Wrong name",
  "Wrong location",
  "Wrong address",
  "Wrong phone or hours",
  "Closed or moved",
  "Other",
] as const;

function StarRow({
  value,
  interactive,
  onSelect,
  disabled,
}: {
  value: number | null;
  interactive: boolean;
  onSelect?: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-0.5" role={interactive ? "radiogroup" : "img"} aria-label={value ? `${value} out of 5 stars` : "No rating yet"}>
      {Array.from({ length: SHOP_RATING_MAX }, (_, i) => {
        const starValue = i + 1;
        const filled = value != null && starValue <= Math.round(value);
        if (interactive) {
          const active = value != null && starValue <= value;
          return (
            <button
              key={starValue}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`Rate ${starValue} star${starValue === 1 ? "" : "s"}`}
              disabled={disabled}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${active ? "text-[var(--accent-ember)]" : "text-[var(--stone)] hover:text-[var(--accent-ember)]"} disabled:opacity-50`}
              onClick={() => onSelect?.(starValue)}
            >
              <Star className="h-4 w-4" strokeWidth={1.8} fill={active ? "currentColor" : "none"} />
            </button>
          );
        }
        return (
          <Star
            key={starValue}
            className={`h-3.5 w-3.5 ${filled ? "text-[var(--accent-ember)]" : "text-[var(--stone)]"}`}
            strokeWidth={1.8}
            fill={filled ? "currentColor" : "none"}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

export function ShopCard({
  shop,
  language = "en",
  highlighted = false,
}: {
  shop: NearbyShop;
  language?: ShopLanguage;
  highlighted?: boolean;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [issue, setIssue] = useState<(typeof ISSUE_OPTIONS)[number]>("Wrong name");
  const [details, setDetails] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const [ratingSummary, setRatingSummary] = useState<ShopRatingSummary | null>(null);
  const [ratingLoading, setRatingLoading] = useState(true);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingNotice, setRatingNotice] = useState<string | null>(null);

  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);

  const category =
    SHOP_CATEGORY_LABELS[(shop.category as ShopCategory) || "other"] || shop.category;
  const primaryName = language === "hi" && shop.name_hi ? shop.name_hi : shop.name;
  const secondaryName = language === "hi" ? shop.name : shop.name_hi;
  const mapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${shop.lat},${shop.lng}`,
  )}`;
  const mapsViewUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${shop.lat},${shop.lng}`,
  )}`;
  const shareText = `${primaryName}${shop.address ? ` · ${shop.address}` : ""}\n${formatDistance(shop.distance_m)} from your area centre\n${mapsViewUrl}`;

  const loadRating = useCallback(async () => {
    setRatingLoading(true);
    try {
      const res = await fetch(`/api/shops/${encodeURIComponent(shop.id)}/rating`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as Partial<ShopRatingSummary> & { error?: string };
      if (!res.ok) {
        setRatingSummary({ shopId: shop.id, average: null, count: 0, myRating: null });
        return;
      }
      setRatingSummary({
        shopId: shop.id,
        average: typeof json.average === "number" ? json.average : null,
        count: typeof json.count === "number" ? json.count : 0,
        myRating: typeof json.myRating === "number" ? json.myRating : null,
      });
    } catch {
      setRatingSummary({ shopId: shop.id, average: null, count: 0, myRating: null });
    } finally {
      setRatingLoading(false);
    }
  }, [shop.id]);

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const res = await fetch(`/api/shops/${encodeURIComponent(shop.id)}/reviews`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as Partial<ShopReviewsPage> & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not load reviews.");
      setReviews(Array.isArray(json.reviews) ? json.reviews : []);
    } catch (e) {
      setReviewsError(e instanceof Error ? e.message : "Could not load reviews.");
    } finally {
      setReviewsLoading(false);
    }
  }, [shop.id]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadRating();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadRating]);

  useEffect(() => {
    if (!reviewsOpen) return;
    const id = window.setTimeout(() => {
      void loadReviews();
    }, 0);
    return () => window.clearTimeout(id);
  }, [reviewsOpen, loadReviews]);

  async function submitRating(value: number) {
    if (ratingBusy) return;
    setRatingBusy(true);
    setRatingNotice(null);
    try {
      const res = await fetch(`/api/shops/${encodeURIComponent(shop.id)}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<ShopRatingSummary> & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save your rating.");
      setRatingSummary({
        shopId: shop.id,
        average: typeof json.average === "number" ? json.average : null,
        count: typeof json.count === "number" ? json.count : 0,
        myRating: typeof json.myRating === "number" ? json.myRating : null,
      });
      setRatingNotice("Your rating was saved.");
      if (reviewsOpen) void loadReviews();
    } catch (e) {
      setRatingNotice(e instanceof Error ? e.message : "Could not save your rating.");
    } finally {
      setRatingBusy(false);
    }
  }

  async function submitReview() {
    const body = reviewDraft.trim();
    if (!body) {
      setReviewNotice("Write a review before posting.");
      return;
    }
    if (body.length > MAX_SHOP_REVIEW_LENGTH) {
      setReviewNotice(`Reviews can be up to ${MAX_SHOP_REVIEW_LENGTH} characters.`);
      return;
    }
    setReviewBusy(true);
    setReviewNotice(null);
    try {
      const res = await fetch(`/api/shops/${encodeURIComponent(shop.id)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; review?: ShopReview };
      if (!res.ok) throw new Error(json.error || "Could not save your review.");
      setReviewDraft("");
      setReviewNotice("Your review was saved.");
      await loadReviews();
      await loadRating();
    } catch (e) {
      setReviewNotice(e instanceof Error ? e.message : "Could not save your review.");
    } finally {
      setReviewBusy(false);
    }
  }

  async function shareShop() {
    setNotice(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: primaryName, text: shareText, url: mapsViewUrl });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setNotice("Shop details copied.");
        return;
      }
      setNotice("Sharing is not available on this device.");
    } catch {
      // user cancelled share or clipboard failed
    }
  }

  async function submitReport() {
    const reportText = [
      "CivicCircle shop report",
      `Issue: ${issue}`,
      details.trim() ? `Details: ${details.trim()}` : null,
      `Shop: ${shop.name}${shop.name_hi ? ` (${shop.name_hi})` : ""}`,
      `ID: ${shop.id}`,
      `Category: ${shop.category}`,
      `Address: ${shop.address || "Not listed"}`,
      `Phone: ${shop.phone || "Not listed"}`,
      `Hours: ${shop.opening_hours || "Not listed"}`,
      `Coords: ${shop.lat}, ${shop.lng}`,
      `Source: ${shop.source}`,
      `Maps: ${mapsViewUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(reportText);
        setNotice("Report details copied. You can share them with the CivicCircle team.");
      } else {
        setNotice("Could not copy automatically. Please share the issue from your device.");
      }
      setReportOpen(false);
      setDetails("");
      setIssue("Wrong name");
    } catch {
      setNotice("Could not copy report details. Please try again.");
    }
  }

  const ratingText = ratingSummary?.average != null
    ? `${ratingSummary.average.toFixed(1)} ★ (${ratingSummary.count})`
    : "No ratings yet";

  return (
    <article
      id={`shop-${shop.id}`}
      tabIndex={-1}
      className={`rounded-[var(--radius-lg)] border bg-[var(--surface)] p-4 transition-colors ${
        highlighted
          ? "border-[var(--hairline-strong)]"
          : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium tracking-[0.1px] text-[var(--ink)]" lang={language === "hi" ? "hi" : "en"}>
            {primaryName}
            {secondaryName ? (
              <span className="ml-2 text-[13px] font-normal text-[var(--mute)]" lang={language === "hi" ? "en" : "hi"}>
                {secondaryName}
              </span>
            ) : null}
          </h3>
          <p className="mt-1 text-[12px] text-[var(--ash)]">{category}</p>
        </div>
        <span className="badge flex-none">{sourceLabel(shop.source)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[12px] text-[var(--body-text)]">
          <StarRow value={ratingSummary?.average ?? null} interactive={false} />
          <span className="tabular-nums text-[var(--mute)]">{ratingLoading ? "…" : ratingText}</span>
        </span>
        {ratingSummary?.myRating ? (
          <span className="text-[11px] text-[var(--ash)]">Your rating: {ratingSummary.myRating}/5</span>
        ) : null}
      </div>

      <p className="mt-2 text-[13px] text-[var(--body-text)]">{shop.address || "Address not listed"}</p>
      <p className="mt-1 text-[12px] tracking-[0.2px] text-[var(--mute)]">
        <span aria-label={`Approximate distance from your area centre: ${formatDistance(shop.distance_m)}`}>
          {formatDistance(shop.distance_m)} from your area centre
        </span>
      </p>
      <p className="mt-1 text-[12px] tracking-[0.2px] text-[var(--mute)]">
        Hours: {shop.opening_hours || "Not listed"}
      </p>
      {shop.phone ? (
        <p className="mt-1 text-[12px] tracking-[0.2px] text-[var(--mute)]">Phone: {shop.phone}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {shop.phone ? (
          <a href={`tel:${shop.phone}`} className="btn btn-sm btn-tertiary">
            Call
          </a>
        ) : null}
        <a
          href={mapsViewUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="btn btn-sm btn-tertiary"
        >
          Open in Maps
        </a>
        <a
          href={mapsDirectionsUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="btn btn-sm btn-primary"
        >
          Directions
        </a>
        <button type="button" className="btn btn-sm btn-tertiary" onClick={() => void shareShop()}>
          Share
        </button>
        <SaveShopButton
          shop={{
            id: shop.id,
            name: shop.name,
            name_hi: shop.name_hi,
            category: shop.category,
            address: shop.address,
            phone: shop.phone,
            opening_hours: shop.opening_hours,
            lat: shop.lat,
            lng: shop.lng,
            distance_m: shop.distance_m,
            source: shop.source,
          }}
        />
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            setReviewsOpen((v) => !v);
            setReviewNotice(null);
          }}
          aria-expanded={reviewsOpen}
        >
          <MessageSquareText className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
          Reviews
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${reviewsOpen ? "rotate-180" : ""}`} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary text-[var(--mute)]"
          onClick={() => {
            setNotice(null);
            setReportOpen((v) => !v);
          }}
          aria-expanded={reportOpen}
        >
          Report info
        </button>
      </div>

      {notice ? (
        <p className="mt-2 text-[12px] text-[var(--accent-ember-ink)]" role="status">
          {notice}
        </p>
      ) : null}

      {reviewsOpen ? (
        <section className="mt-3 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-3" aria-label={`Reviews for ${primaryName}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-[var(--ink)]">Shop reviews</p>
            <span className="text-[11px] text-[var(--mute)]">{ratingLoading ? "…" : ratingText}</span>
          </div>

          <div className="mt-2">
            <p className="mb-1 text-[12px] text-[var(--mute)]">Your rating</p>
            <div className="flex items-center gap-2">
              <StarRow
                value={ratingSummary?.myRating ?? null}
                interactive
                disabled={ratingBusy}
                onSelect={(v) => void submitRating(v)}
              />
              {ratingBusy ? <Loader2 className="h-4 w-4 animate-spin text-[var(--mute)]" strokeWidth={1.8} aria-hidden="true" /> : null}
            </div>
            <p className="mt-1 text-[11px] text-[var(--ash)]">Tap a star to rate from {SHOP_RATING_MIN} to {SHOP_RATING_MAX}.</p>
          </div>

          <div className="mt-3 border-t border-[var(--hairline)] pt-3">
            <label className="block text-[12px] text-[var(--mute)]">
              Write a review
              <textarea
                className="field mt-1"
                rows={3}
                maxLength={MAX_SHOP_REVIEW_LENGTH}
                value={reviewDraft}
                onChange={(e) => setReviewDraft(e.target.value)}
                placeholder="Share what was helpful or what needs fixing."
              />
            </label>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--ash)]">Posted with your ghost handle.</p>
              <p className="text-[11px] tabular-nums text-[var(--ash)]">{reviewDraft.length}/{MAX_SHOP_REVIEW_LENGTH}</p>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={reviewBusy}
                onClick={() => void submitReview()}
              >
                {reviewBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} /> : null}
                {reviewBusy ? "Saving..." : "Post review"}
              </button>
            </div>
          </div>

          {ratingNotice || reviewNotice ? (
            <p className="mt-2 text-[12px] text-[var(--accent-ember)]" role="status">
              {reviewNotice || ratingNotice}
            </p>
          ) : null}

          <div className="mt-3 space-y-2">
            {reviewsLoading ? (
              <p className="text-[12px] text-[var(--mute)]">Loading reviews...</p>
            ) : reviewsError ? (
              <p className="text-[12px] text-[var(--accent-red)]" role="alert">{reviewsError}</p>
            ) : reviews.length === 0 ? (
              <p className="text-[12px] text-[var(--mute)]">No reviews yet. Be the first to share your experience.</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface)] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-[var(--ink)]">{review.handle}{review.isMine ? " (you)" : ""}</p>
                    <span className="text-[11px] text-[var(--ash)]">
                      {review.rating ? `${review.rating}/5` : "No rating"}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--body-text)]">{review.body}</p>
                  <p className="mt-1 text-[12px] text-[var(--ash)]">
                    {new Date(review.createdAt).toLocaleDateString()}
                    {review.edited ? " · edited" : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {reportOpen ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-3">
          <p className="text-[13px] font-medium text-[var(--ink)]">Report incorrect info</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--mute)]">
            Tell us what looks wrong. We&apos;ll copy the details so you can share them with the CivicCircle team.
          </p>
          <label className="mt-3 block text-[12px] text-[var(--mute)]">
            Issue
            <select
              className="field mt-1 text-[var(--ink)]"
              value={issue}
              onChange={(e) => setIssue(e.target.value as (typeof ISSUE_OPTIONS)[number])}
            >
              {ISSUE_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-[var(--surface-elevated)] text-[var(--ink)]">
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block text-[12px] text-[var(--mute)]">
            Details (optional)
            <textarea
              className="field mt-1"
              rows={3}
              maxLength={300}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What should be corrected?"
            />
          </label>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setReportOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void submitReport()}>
              Copy report details
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
