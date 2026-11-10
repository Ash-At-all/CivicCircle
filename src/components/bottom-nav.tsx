"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, MessageSquare, User } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const isHome = pathname === "/home";
  const isProfile = pathname === "/profile";
  const isChats = pathname.startsWith("/chat");

  const activeStyle = {
    bg: "bg-[#F8DC47] text-[#171921] shadow-lg",
    text: "text-[#171921]",
    iconStroke: 2.5,
  } as const;
  const inactiveStyle = {
    text: "text-[#9CA3AF] hover:text-[#FFFFFF] hover:bg-[#FFFFFF]/05",
    textColor: "text-[#9CA3AF]",
    iconStroke: 1.8,
  } as const;

  return (
    <nav
      aria-label="Bottom Navigation"
      className="relative fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[380px] w-full md:hidden"
    >
      {/* Floating pill */}
      <div className="rounded-full border border-[#FFFFFF]/08 bg-[#1A1A2E]/90 backdrop-blur-xl px-1 py-2 shadow-xl">
        <div className="flex items-center justify-between px-3">
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              aria-label="Home"
              className={`flex min-h-[40px] min-w-[40px] flex-col items-center justify-center rounded-full transition-all ${
                isHome ? activeStyle.bg : inactiveStyle.text
              }`}
            >
              <Home
                className={`h-5 w-5 transition-all`}
                strokeWidth={isHome ? activeStyle.iconStroke : inactiveStyle.iconStroke}
              />
              <span
                className={`text-[10px] mt-0.5 font-medium transition-colors ${isHome ? activeStyle.text : inactiveStyle.textColor}`}
              >
                Home
              </span>
            </Link>

            <Link
              href="/home"
              aria-label="Explore"
              className="flex min-h-[40px] min-w-[40px] flex-col items-center justify-center rounded-full text-[#9CA3AF] hover:text-[#FFFFFF] hover:bg-[#FFFFFF]/05 transition-all"
            >
              <Compass className="h-5 w-5" strokeWidth={1.8} />
              <span className="text-[10px] mt-0.5 font-medium">Explore</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/chat/general"
              aria-label="Chats"
              className={`flex min-h-[40px] min-w-[40px] flex-col items-center justify-center rounded-full transition-all ${
                isChats ? activeStyle.bg : inactiveStyle.text
              }`}
            >
              <MessageSquare
                className={`h-5 w-5 transition-all`}
                strokeWidth={isChats ? activeStyle.iconStroke : inactiveStyle.iconStroke}
              />
              <span
                className={`text-[10px] mt-0.5 font-medium transition-colors ${isChats ? activeStyle.text : inactiveStyle.textColor}`}
              >
                Chats
              </span>
            </Link>

            <Link
              href="/profile"
              aria-label="Profile"
              className={`flex min-h-[40px] min-w-[40px] flex-col items-center justify-center rounded-full transition-all ${
                isProfile ? activeStyle.bg : inactiveStyle.text
              }`}
            >
              <User
                className={`h-5 w-5 transition-all`}
                strokeWidth={isProfile ? activeStyle.iconStroke : inactiveStyle.iconStroke}
              />
              <span
                className={`text-[10px] mt-0.5 font-medium transition-colors ${isProfile ? activeStyle.text : inactiveStyle.textColor}`}
              >
                Profile
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Center floating + button */}
      <Link
        href="/home"
        aria-label="Create Post"
        className="absolute bottom-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-[#AD68F5] text-[#FFFFFF] shadow-lg hover:bg-[#F5B5ED] transition-all active:scale-95 z-50"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </Link>
    </nav>
  );
}
