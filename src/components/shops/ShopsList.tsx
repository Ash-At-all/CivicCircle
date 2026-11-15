"use client";

import { useMemo, useState } from "react";
import { ShopCard, type ShopLanguage } from "./ShopCard";
import { SHOP_CATEGORIES, SHOP_CATEGORY_LABELS, type ShopCategory } from "@/features/shops/categories";
import type { NearbyShop } from "@/features/shops/types";

type SortMode = "nearest" | "name";

export function ShopsList({
  shops,
  language = "en",
  selectedShopId,
}: {
  shops: NearbyShop[];
  language?: ShopLanguage;
  selectedShopId?: string | null;
}) {
  const [category, setCategory] = useState<ShopCategory | "all">("all");
  const [sort, setSort] = useState<SortMode>("nearest");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = shops.filter((s) => (category === "all" ? true : s.category === category));
    if (q) {
      list = list.filter((s) => {
        const hay = `${s.name} ${s.name_hi || ""} ${s.address || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      if (sort === "name") {
        const aName = language === "hi" && a.name_hi ? a.name_hi : a.name;
        const bName = language === "hi" && b.name_hi ? b.name_hi : b.name;
        return aName.localeCompare(bName);
      }
      return a.distance_m - b.distance_m;
    });
  }, [shops, category, sort, query, language]);

  return (
    <section aria-label="Nearby shops">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-[11px] uppercase tracking-[0.4px] text-[var(--mute)]">
          Category
          <select
            className="field mt-1"
            value={category}
            onChange={(e) => setCategory(e.target.value as ShopCategory | "all")}
          >
            <option value="all">{SHOP_CATEGORY_LABELS.all}</option>
            {SHOP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {SHOP_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] uppercase tracking-[0.4px] text-[var(--mute)]">
          Sort
          <select
            className="field mt-1"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
          >
            <option value="nearest">Nearest first</option>
            <option value="name">Name A to Z</option>
          </select>
        </label>
        <label className="block text-[11px] uppercase tracking-[0.4px] text-[var(--mute)]">
          Search
          <input
            type="search"
            className="field mt-1"
            placeholder="Search name or address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <p className="mt-3 text-[12px] tracking-[0.3px] text-[var(--mute)]" aria-live="polite">
        {filtered.length} of {shops.length} shop{shops.length === 1 ? "" : "s"} shown
      </p>

      {shops.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] p-4 text-[13px] text-[var(--mute)]">
          No shops are listed within 50 km yet.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] p-4 text-[13px] text-[var(--mute)]">
          No shops match these filters.
        </p>
      ) : (
        <div className="mt-3 grid gap-2.5">
          {filtered.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              language={language}
              highlighted={selectedShopId === shop.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
