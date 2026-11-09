"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, MessageSquare, User, Sparkles } from "lucide-react";
import { CITIES } from "@/lib/cities";
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
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Brand */}
        <Link href="/home" className="flex items-center gap-2.5 px-2 pt-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/20 border border-purple-500/30">
            <Image src="/logo.svg" alt="VibeChat" width={22} height={22} />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white block leading-tight">
              VibeChat
            </span>
            <span className="text-[10px] text-purple-400 font-medium">
              Encrypted & Local
            </span>
          </div>
        </Link>

        {/* Primary Navigation */}
        <nav className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || (href !== "/home" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-purple-600/15 text-purple-300 font-semibold border border-purple-500/20 shadow-sm"
                    : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <Icon
                  className="h-4 w-4"
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Topics Section */}
        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            <Sparkles className="h-3 w-3 text-purple-400" />
            <span>Topics</span>
          </div>

          <div className="space-y-0.5 max-h-[46vh] overflow-y-auto no-scrollbar pr-1">
            {CITIES.map((topic) => {
              const isTopicActive =
                pathname === "/home" && currentTopic === topic.slug;
              return (
                <Link
                  key={topic.slug}
                  href={`/home?topic=${topic.slug}`}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                    isTopicActive
                      ? "bg-white/[0.08] text-white font-medium border border-white/10"
                      : "text-gray-400 hover:bg-white/[0.03] hover:text-gray-200"
                  }`}
                >
                  <span className="truncate">{topic.name}</span>
                  {isTopicActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Legal Links */}
      <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between px-2 text-[11px] text-gray-500">
        <span>© VibeChat</span>
        <div className="flex items-center gap-3">
          <Link href="/privacy" className="hover:text-gray-300 transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-gray-300 transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <Suspense fallback={<div className="p-4 text-xs text-gray-500">Loading sidebar...</div>}>
      <SidebarContent />
    </Suspense>
  );
}
