"use client";

import { useState } from "react";
import { CITY_CONFIGS } from "@/features/area/cities";

type Result = {
  name: string;
  label: string;
  lat: number;
  lng: number;
  city: string;
  cityName?: string;
};

const CITY_NAMES = CITY_CONFIGS.map((city) => city.name).join(", ");

export function AreaPicker({
  onPick,
  onCancel,
}: {
  onPick: (result: Result) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not search for that area.");
      setResults(json.results ?? []);
      if ((json.results ?? []).length === 0) setError("No areas found in the supported cities.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not search for that area.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-5 sm:p-6">
      <h2 className="font-display text-[24px] leading-tight text-[var(--ink)]">Choose an area</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--body-text)]">
        Search across our launch cities: {CITY_NAMES}.
      </p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label className="sr-only" htmlFor="area-search">Search for an area</label>
        <input
          id="area-search"
          className="field min-h-11 min-w-0 flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search area or landmark"
        />
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={loading || query.trim().length < 2}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      {error ? <p className="mt-2 text-[13px] text-[var(--accent-red)]" role="alert">{error}</p> : null}
      {results.length > 0 ? (
        <ul className="mt-3 divide-y divide-[var(--hairline)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)]">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lng}-${i}`}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-[13px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-card)]"
                onClick={() => void onPick(r)}
              >
                <span className="font-medium">{r.name}</span>
                <span className="mt-0.5 block text-[12px] text-[var(--mute)]">
                  {r.cityName ? `${r.cityName} · ${r.label}` : r.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        className="btn btn-sm btn-secondary mt-3 text-[var(--mute)]"
        onClick={onCancel}
      >
        Back
      </button>
    </section>
  );
}
