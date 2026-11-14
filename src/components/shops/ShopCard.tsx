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
      className={`rounded-xl border bg-[var(--surface)] p-4 ${
        highlighted ? "border-[var(--yellow)]" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--text)]" lang={language === "hi" ? "hi" : "en"}>
            {primaryName}
            {secondaryName ? (
              <span className="ml-2 text-sm font-normal text-[var(--text-muted)]" lang={language === "hi" ? "en" : "hi"}>
                {secondaryName}
              </span>
            ) : null}
          </h3>
          <p className="mt-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">{category}</p>
        </div>
        <span className="rounded-md bg-[var(--charcoal-2)] px-2 py-1 text-xs text-[var(--text-muted)]">
          {sourceLabel(shop.source)}
        </span>
      </div>

      <p className="mt-2 text-sm text-[var(--text)]">{shop.address || "Address not listed"}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        <span aria-label={`Approximate distance from your area centre: ${formatDistance(shop.distance_m)}`}>
          {formatDistance(shop.distance_m)} from your area centre
        </span>
      </p>
      {shop.opening_hours ? (
        <p className="mt-1 text-sm text-[var(--text-muted)]">Hours: {shop.opening_hours}</p>
      ) : (
        <p className="mt-1 text-sm text-[var(--text-muted)]">Hours not listed</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {shop.phone ? (
          <a
            href={`tel:${shop.phone}`}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] hover:border-[var(--yellow)]"
          >
            Call
          </a>
        ) : null}
        <a
          href={mapsUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="rounded-lg bg-[var(--yellow)] px-3 py-1.5 text-sm font-medium text-[#171921]"
        >
          Directions
        </a>
      </div>
    </article>
  );
}
