"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, TrendingUp, MapPin, Flame, Users } from "lucide-react";
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
    <div className="mobile-container min-h-[100dvh] bg-[#171921] text-[#F2F0FA] flex flex-col px-4">
      <header className="pt-6 flex items-center justify-between pt-[max(env(safe-area-inset-top),6px)]">
        <Link
          href="/home"
          aria-label="Back to Home"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF]/06 text-[#F2F0FA] hover:bg-[#FFFFFF]/10 transition-all"
        >
          <Compass className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF]/06 text-[#F2F0FA]" />
      </header>

      <div className="flex-1 flex flex-col">
        <div className="px-4 mt-6 mb-4">
          <h1 className="text-h1 text-[#FFFFFF] mb-2">Explore your city</h1>
          <p className="text-[#8B8FA3] text-sm">
            Discover conversations happening near you.
          </p>
        </div>

        <div className="px-4 mb-4">
          <div className="relative">
            <input
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
              className="w-full rounded-[20px] border border-[#FFFFFF]/10 bg-[#FFFFFF]/05 px-4 py-3.5 pl-10 pr-4 text-sm text-[#F2F0FA] placeholder-[#8B8FA3] outline-none transition-all focus:border-[#AD68F5] focus:ring-1 focus:ring-[#AD68F5]"
            />
            <Compass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B8FA3]" strokeWidth={1.75} />
          </div>
        </div>

        <div className="px-4 flex-1 overflow-y-auto">
          {filteredCities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFFFFF]/05 mb-4">
                <Compass className="h-6 w-6 text-[#8B8FA3]" strokeWidth={1.75} />
              </div>
              <p className="text-[#FFFFFF] font-semibold">No results found</p>
              <p className="text-[#8B8FA3] text-sm mt-1">Try a different search</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCities.map((city) => {
                const Icon = CATEGORY_ICONS[city.slug] || Users;
                return (
                  <Link
                    key={city.slug}
                    href={`/home?topic=${city.slug}`}
                    aria-label={`Join ${city.name}`}
                    className="flex items-center justify-between rounded-[16px] border border-[#FFFFFF]/10 bg-[#FFFFFF]/05 px-4 py-4 hover:bg-[#FFFFFF]/08 hover:border-[#FFFFFF]/16 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#AD68F5]/10 text-[#AD68F5]">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <h3 className="text-[#FFFFFF] font-semibold">{city.name}</h3>
                        <p className="text-[#8B8FA3] text-sm">{city.region}</p>
                      </div>
                    </div>
                    <span className="text-[#8B8FA3] text-sm">Join</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiscoveryPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-[50vh] bg-[#171921]">
        <div className="h-8 w-8 animate-[spin_1s_linear_infinite] rounded-full border-2 border-[#AD68F5] border-t-transparent" />
      </div>
    }>
      <DiscoveryContent />
    </Suspense>
  );
}
