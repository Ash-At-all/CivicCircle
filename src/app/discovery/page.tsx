"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, TrendingUp, MapPin, Flame, Users, ArrowLeft } from "lucide-react";
import { CITIES } from "@/features/cities/cities";
import { Suspense } from "react";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  general: Users,
  ask: Flame,
  food: MapPin,
  jobs: TrendingUp,
  housing: MapPin,
  events: Compass,
  marketplace: Users,
  recommendations: Flame,
  tech: TrendingUp,
  fitness: Users,
  travel: Compass,
  news: Flame,
};

function DiscoveryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  const filteredCities = CITIES.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mobile-container">
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[rgba(7,8,10,0.85)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 pt-[max(env(safe-area-inset-top),10px)] sm:px-5">
          <Link
            href="/home"
            aria-label="Back to Home"
            className="btn btn-icon btn-secondary text-[var(--mute)]"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
          <span className="text-sm font-medium tracking-[0.2px] text-[var(--ink)]">Explore</span>
          <div className="w-9" aria-hidden="true" />
        </div>
      </header>

      <div className="flex-1 px-4 pb-10 pt-6 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-label">Discovery</p>
          <h1 className="mt-1 text-display max-w-[16ch] text-balance">Explore your city</h1>
          <p className="mt-3 max-w-md text-body-sm text-[var(--mute)]">
            Discover conversations happening near you. Every board is open and anonymous by
            default.
          </p>
        </div>

        <div className="mt-5 max-w-2xl">
          <label className="sr-only" htmlFor="city-search">Search cities &amp; topics</label>
          <div className="relative">
            <Compass
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ash)]"
              strokeWidth={1.8}
            />
            <input
              id="city-search"
              type="text"
              placeholder="Search cities & topics…"
              value={searchQuery}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) {
                  params.set("q", e.target.value);
                } else {
                  params.delete("q");
                }
                router.push(`/discovery?${params.toString()}`);
              }}
              className="field field-lg pl-9"
            />
          </div>
        </div>

        <div className="mt-6 max-w-2xl">
          {filteredCities.length === 0 ? (
            <div className="card flex flex-col items-center px-4 py-16 text-center">
              <span className="app-tile mb-4 h-12 w-12 text-[var(--mute)]">
                <Compass className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="text-[15px] font-medium text-[var(--ink)]">No results found</p>
              <p className="mt-1 text-[13px] text-[var(--mute)]">Try a different search</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredCities.map((city) => {
                const Icon = CATEGORY_ICONS[city.slug] || Users;
                return (
                  <li key={city.slug}>
                    <Link
                      href={`/home?topic=${city.slug}`}
                      aria-label={`Join ${city.name}`}
                      className="group flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5 transition-colors hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-card)]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="app-tile h-10 w-10 min-h-0 rounded-[var(--radius-md)] text-[var(--mute)] group-hover:text-[var(--ink)]">
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium tracking-[0.1px] text-[var(--ink)]">
                            {city.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] tracking-[0.2px] text-[var(--mute)]">
                            {city.region}
                          </span>
                        </span>
                      </span>
                      <span className="keycap flex-none text-[11px] opacity-60 transition-opacity group-hover:opacity-100">
                        Join
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiscoveryPage() {
  return (
    <Suspense fallback={
      <div className="mobile-container items-center justify-center">
        <div className="h-7 w-7 animate-[spin_1s_linear_infinite] rounded-full border-2 border-[var(--hairline-strong)] border-t-[var(--ink)]" />
      </div>
    }>
      <DiscoveryContent />
    </Suspense>
  );
}
