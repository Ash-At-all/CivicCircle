import Link from "next/link";
import { MessageSquare, Users, SlidersHorizontal } from "lucide-react";
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
    <div className="mobile-container min-h-[100dvh] bg-[#F2F0FA] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#FFFFFF]/12 bg-[#F2F0FA]/95 px-3 py-3 backdrop-blur-md pt-[max(env(safe-area-inset-top),4px)]">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF] p-1">
            <svg className="h-5 w-5 text-[#AD68F5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-h2 text-[#171921]">Chat rooms</h1>
        </div>
        <Link
          href="/home"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF] text-[#AD68F5] hover:bg-[#F2F0FA] transition-all"
          aria-label="Back to feed"
        >
          <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Segmented control */}
        <section className="mb-4">
          <div className="flex items-center rounded-[999px] border border-[#FFFFFF]/10 bg-[#FFFFFF] p-[4px] shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
            <Link
              href={`/chat${setQuery("tab", "popular")}`}
              className={`flex h-9 items-center justify-center rounded-[999px] px-4 py-1 transition-all ${
                tab === "popular"
                  ? "bg-[#F8DC47] text-[#171921] font-semibold text-[11px]"
                  : "text-[#8B8FA3] font-medium text-[11px]"
              }`}
            >
              POPULAR ROOMS
            </Link>
            <Link
              href={`/chat${setQuery("tab", "new")}`}
              className={`flex h-9 items-center justify-center rounded-[999px] px-4 py-1 transition-all ${
                tab === "new"
                  ? "bg-[#F8DC47] text-[#171921] font-semibold text-[11px]"
                  : "text-[#8B8FA3] font-medium text-[11px]"
              }`}
            >
              NEW ROOMS
            </Link>
          </div>
        </section>

        {/* White lower sheet with notch */}
        <div className="relative z-10">
          <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-9 h-[5px] rounded-full bg-[#FFFFFF] z-20" />
          <section className="rounded-t-[36px] rounded-b-[36px] border border-[#FFFFFF]/12 bg-[#FFFFFF] p-4 shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#171921] text-sm font-semibold">All Chat Rooms</h2>
              <button
                type="button"
                aria-label="Filters"
                className="flex h-9 w-9 items-center justify-center rounded-[20px] bg-[#171921]/05 text-[#AD68F5] hover:bg-[#FFFFFF]/10 transition-all"
              >
                <SlidersHorizontal className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-3">
              <Link
                href={`/chat${setQuery("filter", "all")}`}
                className={`flex items-center gap-1.5 rounded-[999px] px-3 py-1.5 text-[10px] font-semibold transition-all ${
                  filter === "all"
                    ? "bg-[#171921] text-[#FFFFFF]"
                    : "bg-[#FFF3B8] text-[#171921]/70 hover:bg-[#FFF3B8]/80"
                }`}
              >
                ALL
              </Link>
              {CITIES.map((city) => (
                <Link
                  key={city.slug}
                  href={`/chat${setQuery("filter", city.slug)}`}
                  className={`flex items-center gap-1.5 rounded-[999px] px-3 py-1.5 text-[10px] font-medium transition-all ${
                    filter === city.slug
                      ? "bg-[#FFF3B8] text-[#171921]"
                      : "bg-[#FFF3B8] text-[#171921]/60 hover:bg-[#FFF3B8]/80 hover:text-[#171921]"
                  }`}
                >
                  {city.name}
                </Link>
              ))}
            </div>

            {/* Room list */}
            <div className="space-y-3">
              {activeRooms.length === 0 ? (
                <div className="rounded-[20px] border border-[#FFFFFF]/12 bg-[#FFFFFF]/40 p-8 text-center">
                  <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#171921]/10 mx-auto mb-3 text-[#AD68F5]">
                    <Users className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <p className="text-[#171921] font-semibold text-sm">No rooms found</p>
                  <p className="text-[11px] text-[#8B8FA3]">Try a different filter.</p>
                </div>
              ) : (
                activeRooms.map((room) => (
                  <Link
                    key={room.id}
                    href={room.href}
                    className="flex items-center justify-between rounded-[20px] border border-[#FFFFFF]/12 bg-[#FFFFFF] p-3 hover:bg-[#FFFFFF]/30 transition-all press-active"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#171921]">
                        <Users className="h-5 w-5 text-[#FFFFFF]" strokeWidth={1.75} />
                      </div>
                      <div>
                        <h3 className="text-[#171921] text-sm font-semibold">{room.name}</h3>
                        <p className="text-[11px] text-[#8B8FA3]">{room.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] text-[#3DDC84]">
                        <span className="h-2 w-2 rounded-full bg-[#3DDC84] animate-pulse" />
                        <span>Online</span>
                      </span>
                      <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-[#F5B5ED] shadow-[0_3px_10px_rgba(245,181,237,0.5)] hover:bg-[#FFE7BE] transition-all press-active" aria-label={`Join ${room.name}`}>
                        <span className="text-[10px] font-medium text-[#171921]">Join</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
