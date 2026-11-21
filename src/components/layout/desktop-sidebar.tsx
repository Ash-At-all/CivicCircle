"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, MessageSquare, User, Bookmark, MapPin } from "lucide-react";
import { CITIES } from "@/features/cities/cities";
import { Suspense } from "react";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home, color: "text-[var(--accent-blue)]", activeBg: "bg-[var(--accent-blue-soft)]" },
  { href: "/nearby", label: "Nearby", icon: MapPin, color: "text-[var(--accent-yellow)]", activeBg: "bg-[var(--accent-yellow-soft)]" },
  { href: "/chat/general", label: "Chats", icon: MessageSquare, color: "text-[var(--accent-green)]", activeBg: "bg-[var(--accent-green-soft)]" },
  { href: "/saved", label: "Saved", icon: Bookmark, color: "text-[var(--accent-yellow)]", activeBg: "bg-[var(--accent-yellow-soft)]" },
  { href: "/profile", label: "Profile", icon: User, color: "text-[var(--accent-red)]", activeBg: "bg-[var(--accent-red-soft)]" },
] as const;

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTopic = searchParams.get("topic") || "general";

  return (
    <div className="flex h-full min-h-0 flex-col justify-between p-3">
      <div className="min-h-0 space-y-6">
        {/* Brand */}
        <Link href="/home" className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/6 px-2.5 py-2 backdrop-blur-xl">
          <span className="flex h-9 w-9 min-h-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-blue-soft)] to-[var(--accent-green-soft)] ring-1 ring-white/10">
            <Image src="/brand/logo.png" alt="CivicCircle" width={29} height={18} className="h-[18px] w-auto" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium tracking-[0.2px] text-[var(--ink)]">
              CivicCircle
            </span>
            <span className="block truncate text-[11px] leading-4 tracking-[0.3px] text-white/65">
              Local boards &amp; chat
            </span>
          </span>
        </Link>

        {/* Primary Navigation */}
        <nav className="space-y-1.5" aria-label="Primary">
          {NAV_ITEMS.map(({ href, label, icon: Icon, color, activeBg }) => {
            const isActive =
              pathname === href || (href !== "/home" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-sm tracking-[0.2px] transition-colors backdrop-blur-xl ${
                  isActive
                    ? `border-white/12 ${activeBg} font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`
                    : "border-transparent text-white/75 hover:bg-white/6 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-4.5 w-4.5 ${isActive ? "text-white" : color}`}
                  strokeWidth={isActive ? 2.1 : 1.8}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Topics Section */}
        <div className="space-y-2 border-t border-[var(--hairline)] pt-4">
          <div className="flex items-center gap-2 px-2 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ash)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--stone)]" />
            <span>Topics</span>
          </div>

          <div className="no-scrollbar max-h-[46vh] space-y-0.5 overflow-y-auto pr-1">
            {CITIES.map((topic) => {
              const isTopicActive =
                pathname === "/home" && currentTopic === topic.slug;
              return (
                <Link
                  key={topic.slug}
                  href={`/home?topic=${topic.slug}`}
                  aria-current={isTopicActive ? "page" : undefined}
                  className={`flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[13px] transition-colors ${
                    isTopicActive
                      ? "bg-[var(--surface-elevated)] font-medium text-[var(--on-dark)]"
                      : "text-[var(--mute)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--ink)]"
                  }`}
                >
                  <span className="truncate">{topic.name}</span>
                  {isTopicActive && (
                    <span className="h-1 w-1 flex-none rounded-full bg-[var(--ink)]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Legal Links */}
      <div className="mt-4 flex flex-col gap-2 border-t border-[var(--hairline)] px-2 pt-4 text-[11px] tracking-[0.3px] text-[var(--ash)]">
        <span>© CivicCircle</span>
        <div className="flex items-center gap-3">
          <Link href="/privacy" className="transition-colors hover:text-[var(--ink)]">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[var(--ink)]">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <Suspense fallback={<div className="p-4 text-xs text-[var(--ash)]">Loading sidebar...</div>}>
      <SidebarContent />
    </Suspense>
  );
}
