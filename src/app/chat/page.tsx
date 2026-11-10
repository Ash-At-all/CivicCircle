import Link from "next/link";
import { MessageSquare, Users } from "lucide-react";
import { CITIES } from "@/lib/cities";

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
    <div className="mobile-container min-h-[100dvh] bg-[#171921] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#FFFFFF]/08 bg-[#171921]/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F2F0FA]/10 border border-[#AD68F5]/30">
            <svg className="h-5 w-5 text-[#AD68F5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-base font-bold tracking-tight text-[#F2F0FA]">All Chat Rooms</h1>
        </div>
        <Link
          href="/home"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F0FA]/10 text-[#AD68F5] hover:text-[#FFFFFF] transition"
          aria-label="Back to feed"
        >
          <MessageSquare className="h-4 w-4" />
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Segmented control */}
        <section className="mb-4">
          <div className="flex items-center gap-1 rounded-xl border border-[#FFFFFF]/08 bg-[#1A1A2E] p-1">
            <Link
              href={`/chat${setQuery("tab", "popular")}`}
              className={`flex h-9 items-center justify-center rounded-lg px-3 py-1 text-[11px] font-bold transition ${
                tab === "popular" ? "bg-[#F8DC47] text-[#171921]" : "text-[#9CA3AF]"
              }`}
            >
              POPULAR ROOMS
            </Link>
            <Link
              href={`/chat${setQuery("tab", "new")}`}
              className={`flex h-9 items-center justify-center rounded-lg px-3 py-1 text-[11px] font-medium transition ${
                tab === "new" ? "bg-[#F8DC47] text-[#171921]" : "text-[#9CA3AF]"
              }`}
            >
              NEW ROOMS
            </Link>
          </div>
        </section>

        {/* Filter pills */}
        <section className="mb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <Link
              href={`/chat${setQuery("filter", "all")}`}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium transition ${
                filter === "all"
                  ? "bg-[#171921] text-[#F2F0FA] shadow-lg"
                  : "bg-[#1A1A2E] border border-[#FFFFFF]/10 text-[#F2F0FA]/60 hover:text-[#FFFFFF]"
              }`}
            >
              ALL
            </Link>
            {CITIES.map((city) => (
              <Link
                key={city.slug}
                href={`/chat${setQuery("filter", city.slug)}`}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium transition ${
                  filter === city.slug
                    ? "bg-[#F2F0FA]/20 border border-[#F2F0FA]/30 text-[#F2F0FA]"
                    : "bg-[#1A1A2E] border border-[#FFFFFF]/10 text-[#F2F0FA]/60 hover:text-[#FFFFFF] hover:border-[#AD68F5]/40"
                }`}
              >
                {city.name}
              </Link>
            ))}
          </div>
        </section>

        {/* Room list */}
        <section>
          <div className="space-y-2">
            {activeRooms.length === 0 ? (
              <div className="rounded-2xl border border-[#FFFFFF]/08 bg-[#1A1A2E] p-8 text-center space-y-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F2F0FA]/20 mx-auto mb-2 text-[#AD68F5]">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-[#171921]">No rooms found</p>
                <p className="text-xs text-[#6B7280]">Try a different filter.</p>
              </div>
            ) : (
              activeRooms.map((room) => (
                <Link
                  key={room.id}
                  href={room.href}
                  className="flex items-center justify-between rounded-xl border border-[#FFFFFF]/08 bg-[#1A1A2E] p-3 hover:border-[#AD68F5]/30 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#AD68F5]/20 text-[#AD68F5]">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#F2F0FA]">{room.name}</h3>
                      <p className="text-[10px] text-[#6B7280]">{room.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] text-[#22C55E]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                      <span>Online</span>
                    </span>
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5B5ED] text-[#171921] font-bold text-[10px] shadow-md hover:bg-[#F8DC47] transition"
                      aria-label={`Join ${room.name}`}
                    >
                      Join
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Legend */}
        <section className="mt-6 pt-4 border-t border-[#FFFFFF]/06">
          <div className="flex items-center gap-2 text-[10px] text-[#6B7280]">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span>Online now</span>
            </span>
            <span className="h-[1px] w-4 bg-[#FFFFFF]/20" />
            <span>Tap Join to enter a room</span>
          </div>
        </section>
      </div>
    </div>
  );
}
