import Link from "next/link";
import { MessageSquare, Users, SlidersHorizontal, ArrowLeft } from "lucide-react";
import { CITIES } from "@/features/cities/cities";

export default function ChatDiscoveryPage({
  searchParams,
}: {
  searchParams?: { tab?: string; filter?: string };
}) {
  const tab = searchParams?.tab || "popular";
  const filter = searchParams?.filter || "all";

  const rooms = CITIES.map((city) => ({
    id: city.slug,
    name: city.name,
    description: city.region,
    href: `/chat/${city.slug}`,
    online: true,
  }));

  const filteredRooms =
    filter === "all"
      ? rooms
      : rooms.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()));

  const popularRooms = [...filteredRooms].slice(0, 4);
  const newRooms = [...filteredRooms].slice(4);

  const activeRooms = tab === "popular" ? popularRooms : newRooms;

  const setQuery = (key: string, value: string) => {
    const sp = new URLSearchParams();
    if (key === "tab") sp.set("tab", value);
    if (key === "filter") sp.set("filter", value);
    const qs = sp.toString();
    return qs ? `?${qs}` : "";
  };

  return (
    <div className="mobile-container">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-[rgba(7,8,10,0.85)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 pt-[max(env(safe-area-inset-top),10px)] sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/home"
              className="btn btn-icon btn-secondary text-[var(--mute)]"
              aria-label="Back to feed"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </Link>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium tracking-[0.2px] text-[var(--ink)]">
                Chat rooms
              </span>
              <span className="block truncate text-[11px] tracking-[0.3px] text-[var(--ash)]">
                City channels
              </span>
            </span>
          </div>
          <span className="badge badge-success flex-none">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
            live
          </span>
        </div>
      </header>

      <div className="flex-1 px-4 py-5 sm:px-6">
        {/* Segmented control */}
        <section className="mb-4">
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface)] p-1">
            <Link
              href={`/chat${setQuery("tab", "popular")}`}
              className={`pill-tab ${tab === "popular" ? "pill-tab-active" : ""}`}
            >
              Popular rooms
            </Link>
            <Link
              href={`/chat${setQuery("tab", "new")}`}
              className={`pill-tab ${tab === "new" ? "pill-tab-active" : ""}`}
            >
              New rooms
            </Link>
          </div>
        </section>

        <section className="card">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--hairline)] px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[var(--mute)]" strokeWidth={1.8} />
              <h2 className="text-[13px] font-medium tracking-[0.2px] text-[var(--ink)]">
                All chat rooms
              </h2>
            </div>
            <button
              type="button"
              aria-label="Filters"
              className="btn btn-icon btn-secondary h-8 w-8 min-h-0 text-[var(--mute)]"
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>

          {/* Filter pills */}
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-[var(--hairline)] px-3 py-2.5">
            <Link
              href={`/chat${setQuery("filter", "all")}`}
              className={`pill-tab flex-none ${filter === "all" ? "pill-tab-active" : ""}`}
            >
              All
            </Link>
            {CITIES.map((city) => (
              <Link
                key={city.slug}
                href={`/chat${setQuery("filter", city.slug)}`}
                className={`pill-tab flex-none ${filter === city.slug ? "pill-tab-active" : ""}`}
              >
                {city.name}
              </Link>
            ))}
          </div>

          {/* Room list */}
          <div className="p-2">
            {activeRooms.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-12 text-center">
                <span className="app-tile mb-3 h-11 w-11 text-[var(--mute)]">
                  <Users className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <p className="text-[15px] font-medium text-[var(--ink)]">No rooms found</p>
                <p className="mt-1 text-[12px] text-[var(--mute)]">Try a different filter.</p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {activeRooms.map((room) => (
                  <li key={room.id}>
                    <Link
                      href={room.href}
                      className="group flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-2.5 py-2.5 transition-colors hover:bg-[var(--surface-card)]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="app-tile h-10 w-10 min-h-0 rounded-[var(--radius-md)] text-[var(--mute)]">
                          <Users className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium tracking-[0.1px] text-[var(--ink)]">
                            {room.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] tracking-[0.3px] text-[var(--mute)]">
                            {room.description}
                          </span>
                        </span>
                      </span>
                      <span className="flex flex-none items-center gap-2.5">
                        <span className="hidden items-center gap-1.5 text-[11px] tracking-[0.3px] text-[var(--mute)] sm:inline-flex">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
                          Online
                        </span>
                        <span className="keycap text-[11px]">↵</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <p className="mt-4 text-[11px] leading-relaxed tracking-[0.2px] text-[var(--ash)]">
          Rooms are public to everyone in the city. Keep it civil — reports go to moderators.
        </p>
      </div>
    </div>
  );
}
