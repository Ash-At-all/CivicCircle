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
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-lg font-semibold text-[var(--text)]">Choose an area</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Search for a place in Chhatrapati Sambhajinagar.
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label className="sr-only" htmlFor="area-search">Search for an area</label>
        <input
          id="area-search"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text)]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search area or landmark"
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--yellow)] px-3 py-2 text-sm font-semibold text-[var(--charcoal)] disabled:opacity-60"
          disabled={loading || query.trim().length < 2}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-400" role="alert">{error}</p> : null}
      {results.length > 0 ? (
        <ul className="mt-3 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lng}-${i}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-hover,#222)]"
                onClick={() => void onPick(r)}
              >
                <span className="font-medium">{r.name}</span>
                <span className="block text-xs text-[var(--text-muted)]">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="mt-3 text-sm text-[var(--text-muted)] underline" onClick={onCancel}>
        Back
      </button>
    </section>
  );
}
