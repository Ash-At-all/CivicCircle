"use client";

import { useState } from "react";

type Result = { name: string; label: string; lat: number; lng: number };

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
      if ((json.results ?? []).length === 0) setError("No areas found in the launch city.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not search for that area.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-white/12 bg-white/8 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-2xl backdrop-saturate-150 sm:p-6">
      <h2 className="text-[18px] font-semibold tracking-[0.1px] text-[var(--ink)]">Choose an area</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">
        Search in Chhatrapati Sambhajinagar.
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
          className="field min-h-[44px] min-w-0 flex-1 rounded-full border-white/12 bg-white/8 px-4 text-white placeholder:text-white/45 backdrop-blur-xl"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search area or landmark"
        />
        <button
          type="submit"
          className="btn btn-primary btn-lg rounded-full"
          disabled={loading || query.trim().length < 2}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      {error ? <p className="mt-2 text-[13px] text-[var(--accent-red)]" role="alert">{error}</p> : null}
      {results.length > 0 ? (
        <ul className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/12 bg-white/8 backdrop-blur-xl">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lng}-${i}`}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-[13px] text-[var(--ink)] transition-colors hover:bg-white/10"
                onClick={() => void onPick(r)}
              >
                <span className="font-medium">{r.name}</span>
                <span className="mt-0.5 block text-[11px] tracking-[0.2px] text-[var(--mute)]">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        className="btn btn-sm btn-secondary mt-3 rounded-full border-white/15 bg-white/8 text-white/80 hover:bg-white/12"
        onClick={onCancel}
      >
        Back
      </button>
    </section>
  );
}
