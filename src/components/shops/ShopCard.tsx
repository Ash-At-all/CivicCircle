"use client";

import { useState } from "react";
import { SaveShopButton } from "@/components/saved/save-shop-button";
import { formatDistance, sourceLabel } from "@/features/shops/format";
import { SHOP_CATEGORY_LABELS, type ShopCategory } from "@/features/shops/categories";
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
          <p className="mt-1 text-[11px] uppercase tracking-[0.4px] text-[var(--ash)]">{category}</p>
        </div>
        <span className="badge flex-none">{sourceLabel(shop.source)}</span>
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
        <p className="mt-2 text-[12px] tracking-[0.2px] text-[var(--accent-green)]" role="status">
          {notice}
        </p>
      ) : null}

      {reportOpen ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-3">
          <p className="text-[13px] font-medium text-[var(--ink)]">Report incorrect info</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--mute)]">
            Tell us what looks wrong. We&apos;ll copy the details so you can share them with the CivicCircle team.
          </p>
          <label className="mt-3 block text-[11px] uppercase tracking-[0.4px] text-[var(--mute)]">
            Issue
            <select
              className="field mt-1 text-white"
              value={issue}
              onChange={(e) => setIssue(e.target.value as (typeof ISSUE_OPTIONS)[number])}
            >
              {ISSUE_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-[#141416] text-white">
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block text-[11px] uppercase tracking-[0.4px] text-[var(--mute)]">
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
