"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, MessageSquare, User } from "lucide-react";

export function BottomNav({ onNewPost }: { onNewPost?: () => void }) {
  const pathname = usePathname();

  const isHome = pathname === "/home" || pathname === "/";
  const isProfile = pathname === "/profile";

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-[430px] border-t border-white/[0.08] bg-[#0E0E18]/90 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),8px)] pt-2"
    >
      <div className="flex items-center justify-around px-2">
        {/* Home */}
        <Link
          href="/home"
          aria-label="Home"
          className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-xl transition-colors ${
            isHome ? "text-purple-400" : "text-gray-400 hover:text-white"
          }`}
        >
          <Home className="h-5 w-5" strokeWidth={isHome ? 2.5 : 1.8} />
          <span className="text-[10px] mt-1 font-medium">Home</span>
        </Link>

        {/* Explore */}
        <Link
          href="/home?tab=explore"
          aria-label="Explore"
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-xl text-gray-400 hover:text-white transition-colors"
        >
          <Compass className="h-5 w-5" strokeWidth={1.8} />
          <span className="text-[10px] mt-1 font-medium">Explore</span>
        </Link>

        {/* Center Action Button (Create/New Post) */}
        <button
          type="button"
          onClick={onNewPost}
          aria-label="Create Post"
          className="gradient-circle-btn flex h-11 w-11 items-center justify-center rounded-full text-white active:scale-95 transition-transform"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>

        {/* Chats / Topics */}
        <Link
          href="/home?tab=chats"
          aria-label="Chats"
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-xl text-gray-400 hover:text-white transition-colors"
        >
          <MessageSquare className="h-5 w-5" strokeWidth={1.8} />
          <span className="text-[10px] mt-1 font-medium">Chats</span>
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          aria-label="Profile"
          className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-xl transition-colors ${
            isProfile ? "text-purple-400" : "text-gray-400 hover:text-white"
          }`}
        >
          <User className="h-5 w-5" strokeWidth={isProfile ? 2.5 : 1.8} />
          <span className="text-[10px] mt-1 font-medium">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
