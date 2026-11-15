import { formatDistance, sourceLabel } from "@/features/shops/format";
import { SHOP_CATEGORY_LABELS, type ShopCategory } from "@/features/shops/categories";
import type { NearbyShop } from "@/features/shops/types";

export type ShopLanguage = "en" | "hi";

export function ShopCard({
  shop,
  language = "en",
  highlighted = false,
}: {
  shop: NearbyShop;
  language?: ShopLanguage;
  highlighted?: boolean;
}) {
  const category =
    SHOP_CATEGORY_LABELS[(shop.category as ShopCategory) || "other"] || shop.category;
  const primaryName = language === "hi" && shop.name_hi ? shop.name_hi : shop.name;
  const secondaryName = language === "hi" ? shop.name : shop.name_hi;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${shop.lat},${shop.lng}`,
  )}`;

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
      {shop.opening_hours ? (
        <p className="mt-1 text-[12px] tracking-[0.2px] text-[var(--mute)]">Hours: {shop.opening_hours}</p>
      ) : (
        <p className="mt-1 text-[12px] tracking-[0.2px] text-[var(--ash)]">Hours not listed</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {shop.phone ? (
          <a href={`tel:${shop.phone}`} className="btn btn-sm btn-tertiary">
            Call
          </a>
        ) : null}
        <a
          href={mapsUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="btn btn-sm btn-primary"
        >
          Directions
        </a>
      </div>
    </article>
  );
}
