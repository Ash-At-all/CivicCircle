"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, MessageSquare, User } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const isHome = pathname === "/home";
  const isProfile = pathname === "/profile";
  const isChats = pathname.startsWith("/chat");

  const activeItem = {
    container: "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full bg-[#F8DC47] shadow-lg",
    text: "text-[#171921]",
    iconStroke: 2.5,
  } as const;

  const inactiveItem = {
    container: "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full text-[#F2F0FA]/60 hover:text-[#FFFFFF] hover:bg-[#FFFFFF]/05",
    text: "text-[#F2F0FA]/60",
    iconStroke: 1.75,
  } as const;

  return (
    <nav
      aria-label="Bottom Navigation"
      className="relative fixed bottom-[16px] left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-40px)] w-full md:hidden"
    >
      {/* Floating black pill */}
      <div className="rounded-[999px] border border-[#FFFFFF]/08 bg-[#171921]/95 backdrop-blur-xl p-1.5 pb-[max(env(safe-area-inset-bottom),8px)] shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between px-3 h-16">
          <div className="flex items-center gap-2.5">
            <Link
              href="/home"
              aria-label="Home"
              aria-current={isHome ? "page" : undefined}
              className={`${isHome ? activeItem.container : inactiveItem.container} transition-all`}
            >
              <Home
                className={`h-5 w-5 transition-all`}
                strokeWidth={isHome ? activeItem.iconStroke : inactiveItem.iconStroke}
              />
              <span
                className={`text-[10px] mt-0.5 font-medium transition-all ${isHome ? activeItem.text : inactiveItem.text}`}
              >
                Home
              </span>
            </Link>

            <Link
              href="/discovery"
              aria-label="Explore"
              className={`${inactiveItem.container} transition-all`}
            >
              <Compass className={`h-5 w-5 transition-all`} strokeWidth={inactiveItem.iconStroke} />
              <span className={`text-[10px] mt-0.5 font-medium transition-all ${inactiveItem.text}`}>
                Explore
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/chat/general"
              aria-label="Chats"
              aria-current={isChats ? "page" : undefined}
              className={`${isChats ? activeItem.container : inactiveItem.container} transition-all`}
            >
              <MessageSquare
                className={`h-5 w-5 transition-all`}
                strokeWidth={isChats ? activeItem.iconStroke : inactiveItem.iconStroke}
              />
              <span
                className={`text-[10px] mt-0.5 font-medium transition-all ${isChats ? activeItem.text : inactiveItem.text}`}
              >
                Chats
              </span>
            </Link>

            <Link
              href="/profile"
              aria-label="Profile"
              aria-current={isProfile ? "page" : undefined}
              className={`${isProfile ? activeItem.container : inactiveItem.container} transition-all`}
            >
              <User
                className={`h-5 w-5 transition-all`}
                strokeWidth={isProfile ? activeItem.iconStroke : inactiveItem.iconStroke}
              />
              <span
                className={`text-[10px] mt-0.5 font-medium transition-all ${isProfile ? activeItem.text : inactiveItem.text}`}
              >
                Profile
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Center floating purple + button (56px, slightly above nav) */}
      <Link
        href="#"
        aria-label="Create Post"
        className="absolute bottom-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-[56px] w-[56px] items-center justify-center rounded-full bg-[#AD68F5] text-[#FFFFFF] shadow-[0_6px_20px_rgba(0,0,0,0.08)] hover:bg-[#F5B5ED] transition-all active:scale-[0.97] z-50"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </Link>
    </nav>
  );
}
