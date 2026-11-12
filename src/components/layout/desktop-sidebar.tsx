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
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Brand */}
        <Link href="/home" className="flex items-center gap-2.5 px-2 pt-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8DC47]/20 border border-[#F8DC47]/40">
            <Image src="/brand/logo.png" alt="CivicCircle" width={22} height={22} />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-[#F2F0FA] block leading-tight">
              CivicCircle
            </span>
            <span className="text-[10px] text-[#AD68F5] font-medium">
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
                    ? "bg-[#F8DC47] text-[#171921] font-semibold shadow-lg"
                    : "text-[#F2F0FA]/60 hover:text-[#FFFFFF] hover:bg-[#FFFFFF]/05"
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-all ${isActive ? "text-[#171921]" : "text-[#F2F0FA]/60"}`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className={isActive ? "text-[#171921]" : "text-[#F2F0FA]/60"}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Topics Section */}
        <div className="space-y-2 pt-2 border-t border-[#FFFFFF]/06">
          <div className="flex items-center gap-1.5 px-3 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
            <span className="h-3 w-3 rounded-full bg-[#AD68F5]" />
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
                      ? "bg-[#F8DC47] text-[#171921] font-medium shadow-lg"
                      : "text-[#F2F0FA]/60 hover:text-[#FFFFFF] hover:bg-[#FFFFFF]/05"
                  }`}
                >
                  <span className="truncate">{topic.name}</span>
                  {isTopicActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#171921]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Legal Links */}
      <div className="pt-4 border-t border-[#FFFFFF]/06 flex items-center justify-between px-2 text-[11px] text-[#6B7280]">
        <span>© CivicCircle</span>
        <div className="flex items-center gap-3">
          <Link href="/privacy" className="hover:text-[#FFFFFF] transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#FFFFFF] transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <Suspense fallback={<div className="p-4 text-xs text-[#6B7280]">Loading sidebar...</div>}>
      <SidebarContent />
    </Suspense>
  );
}
