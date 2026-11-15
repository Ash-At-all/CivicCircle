"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, MessageSquare, User } from "lucide-react";
import { CITIES } from "@/features/cities/cities";
import { Suspense } from "react";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/chat/general", label: "Chats", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
] as const;

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTopic = searchParams.get("topic") || "general";

  return (
    <div className="flex h-full min-h-0 flex-col justify-between p-3">
      <div className="min-h-0 space-y-6">
        {/* Brand */}
        <Link href="/home" className="flex items-center gap-2.5 px-2 pt-2">
          <span className="app-tile h-9 w-9 min-h-0">
            <Image src="/brand/logo.png" alt="CivicCircle" width={22} height={22} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium tracking-[0.2px] text-[var(--ink)]">
              CivicCircle
            </span>
            <span className="block truncate text-[11px] leading-4 tracking-[0.3px] text-[var(--mute)]">
              Local boards &amp; chat
            </span>
          </span>
        </Link>

        {/* Primary Navigation */}
        <nav className="space-y-1" aria-label="Primary">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || (href !== "/home" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2 text-sm tracking-[0.2px] transition-colors ${
                  isActive
                    ? "border-[var(--hairline)] bg-[var(--surface-card)] font-medium text-[var(--on-dark)]"
                    : "border-transparent text-[var(--body-text)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-[var(--ink)]" : "text-[var(--mute)]"}`}
                  strokeWidth={isActive ? 2 : 1.7}
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
