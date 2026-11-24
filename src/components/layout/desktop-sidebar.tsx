"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, MessageSquare, User, Bookmark, MapPin } from "lucide-react";
import { CITIES } from "@/features/cities/cities";
import { Suspense } from "react";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/nearby", label: "Nearby", icon: MapPin },
  { href: "/chat/general", label: "Chats", icon: MessageSquare },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/profile", label: "Profile", icon: User },
] as const;

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTopic = searchParams.get("topic") || "general";

  return (
    <div className="flex h-full min-h-0 flex-col justify-between px-3 py-4">
      <div className="min-h-0">
        {/* Brand */}
        <Link
          href="/home"
          className="flex items-center gap-2.5 px-2 py-1"
          aria-label="CivicCircle home"
        >
          <span
            className="h-2 w-2 flex-none bg-[var(--accent-ember)]"
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block truncate font-display text-[17px] leading-none text-[var(--ink)]">
              CivicCircle
            </span>
            <span className="mt-1 block truncate text-[12px] leading-4 text-[var(--mute)]">
              Local boards &amp; chat
            </span>
          </span>
        </Link>

        {/* Primary navigation */}
        <nav className="mt-6 space-y-0.5" aria-label="Primary">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || (href !== "/home" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-9 items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 text-[14px] transition-colors ${
                  isActive
                    ? "bg-[var(--surface-elevated)] font-medium text-[var(--ink)]"
                    : "text-[var(--mute)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                }`}
              >
                {isActive ? (
                  <span
                    className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-[var(--accent-ember)]"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon
                  className={`h-[17px] w-[17px] flex-none ${
                    isActive ? "text-[var(--ink)]" : "text-[var(--ash)]"
                  }`}
                  strokeWidth={1.7}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Topics */}
        <div className="mt-7 border-t border-[var(--hairline)] pt-5">
          <p className="mb-2 px-2.5 text-[12px] font-medium text-[var(--ash)]">Topics</p>

          <div className="no-scrollbar max-h-[46vh] space-y-px overflow-y-auto pr-1">
            {CITIES.map((topic) => {
              const isTopicActive =
                pathname === "/home" && currentTopic === topic.slug;
              return (
                <Link
                  key={topic.slug}
                  href={`/home?topic=${topic.slug}`}
                  aria-current={isTopicActive ? "page" : undefined}
                  className={`flex min-h-8 items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 text-[13px] transition-colors ${
                    isTopicActive
                      ? "bg-[var(--surface-elevated)] font-medium text-[var(--ink)]"
                      : "text-[var(--mute)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                  }`}
                >
                  <span className="truncate">{topic.name}</span>
                  {isTopicActive ? (
                    <span
                      className="h-1.5 w-1.5 flex-none bg-[var(--accent-ember)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 border-t border-[var(--hairline)] px-2.5 pt-4 text-[12px] text-[var(--ash)]">
        <div className="flex items-center gap-3">
          <Link href="/privacy" className="transition-colors hover:text-[var(--ink)]">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[var(--ink)]">
            Terms
          </Link>
        </div>
        <p className="mt-2">© CivicCircle</p>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <Suspense
      fallback={
        <div className="px-3 py-4" aria-hidden="true">
          <div className="h-8 rounded-[var(--radius-sm)] bg-[var(--surface)]" />
          <div className="mt-6 space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 rounded-[var(--radius-sm)] bg-[var(--surface)]"
              />
            ))}
          </div>
        </div>
      }
    >
      <SidebarContent />
    </Suspense>
  );
}
