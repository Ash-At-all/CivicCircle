"use client";

import { useEffect, useMemo, useState } from "react";
import { ShopCard, type ShopLanguage } from "./ShopCard";
import { SHOP_CATEGORIES, SHOP_CATEGORY_LABELS, type ShopCategory } from "@/features/shops/categories";
import type { NearbyShop } from "@/features/shops/types";

type SortMode = "nearest" | "name";

const RECENT_SHOP_SEARCHES_KEY = "civiccircle-shop-searches";

export function ShopsList({
  shops,
  language = "en",
  selectedShopId,
  reviewsSignal = 0,
}: {
  shops: NearbyShop[];
  language?: ShopLanguage;
  selectedShopId?: string | null;
  reviewsSignal?: number;
}) {
  const [category, setCategory] = useState<ShopCategory | "all">("all");
  const [sort, setSort] = useState<SortMode>("nearest");
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(RECENT_SHOP_SEARCHES_KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((v): v is string => typeof v === "string").slice(0, 5));
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // A marker click selects a shop, so clear filters that could hide its card.
  useEffect(() => {
    if (!selectedShopId) return;
    const id = window.setTimeout(() => {
      setCategory("all");
      setQuery("");
    }, 0);
    return () => window.clearTimeout(id);
  }, [selectedShopId]);

  function rememberSearch(value: string) {
    const q = value.trim();
    if (q.length < 2) return;
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 5);
      try {
        window.localStorage.setItem(RECENT_SHOP_SEARCHES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

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
        <label className="block text-[12px] text-[var(--mute)]">
          Category
          <select
            className="field mt-1 text-[var(--ink)]"
            value={category}
            onChange={(e) => setCategory(e.target.value as ShopCategory | "all")}
          >
            <option value="all" className="bg-[var(--surface-elevated)] text-[var(--ink)]">{SHOP_CATEGORY_LABELS.all}</option>
            {SHOP_CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-[var(--surface-elevated)] text-[var(--ink)]">
                {SHOP_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] text-[var(--mute)]">
          Sort
          <select
            className="field mt-1 text-[var(--ink)]"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
          >
            <option value="nearest" className="bg-[var(--surface-elevated)] text-[var(--ink)]">Nearest first</option>
            <option value="name" className="bg-[var(--surface-elevated)] text-[var(--ink)]">Name A to Z</option>
          </select>
        </label>
        <label className="block text-[12px] text-[var(--mute)]">
          Search
          <input
            type="search"
            className="field mt-1"
            placeholder="Search name or address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") rememberSearch(query);
            }}
            onBlur={() => rememberSearch(query)}
          />
        </label>
      </div>

      {recentSearches.length > 0 && !query.trim() ? (
        <div className="mt-3">
          <p className="mb-2 text-[12px] font-medium text-[var(--mute)]">Recent searches</p>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                className="inline-flex min-h-8 items-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 text-[12px] text-[var(--body-text)] transition-colors hover:border-[var(--hairline-strong)]"
                onClick={() => setQuery(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-[12px] text-[var(--mute)]" aria-live="polite">
        {filtered.length} of {shops.length} shop{shops.length === 1 ? "" : "s"} shown
      </p>

      {shops.length === 0 ? (
        <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] p-4 text-center">
          <p className="text-[14px] font-medium text-[var(--ink)]">No shops in this radius yet</p>
          <p className="mt-1 text-[13px] text-[var(--mute)]">
            Try increasing the search radius in map settings or check again later.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] p-4 text-center">
          <p className="text-[14px] font-medium text-[var(--ink)]">No shops match your filters</p>
          <p className="mt-1 text-[13px] text-[var(--mute)]">
            Try a different name, category, or sort option.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-tertiary mx-auto mt-3"
            onClick={() => {
              setQuery("");
              setCategory("all");
              setSort("nearest");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-3 grid gap-2.5">
          {filtered.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              language={language}
              highlighted={selectedShopId === shop.id}
              reviewsSignal={selectedShopId === shop.id ? reviewsSignal : 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
