"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, MessageSquare, User } from "lucide-react";

const ITEMS = [
  { href: "/home", label: "Home", icon: Home, color: "text-[var(--accent-blue)]", activeBg: "bg-[var(--accent-blue-soft)]" },
  { href: "/discovery", label: "Explore", icon: Compass, color: "text-[var(--accent-yellow)]", activeBg: "bg-[var(--accent-yellow-soft)]" },
  { href: "/chat/general", label: "Chats", icon: MessageSquare, color: "text-[var(--accent-green)]", activeBg: "bg-[var(--accent-green-soft)]" },
  { href: "/profile", label: "Profile", icon: User, color: "text-[var(--accent-red)]", activeBg: "bg-[var(--accent-red-soft)]" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/home" ? pathname === "/home" : pathname.startsWith(href.split("?")[0]);

  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
    >
      <div className="mx-auto w-full max-w-md px-3 pb-[max(env(safe-area-inset-bottom),10px)]">
        <div className="flex items-center justify-between gap-1 rounded-full border border-white/12 bg-white/10 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150">
          {left.map(({ href, label, icon: Icon, color, activeBg }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium tracking-[0.2px] transition-colors ${
                  active
                    ? `${activeBg} text-white`
                    : "text-white/65 hover:text-white"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? "text-white" : color}`} strokeWidth={active ? 2.1 : 1.8} />
                <span>{label}</span>
              </Link>
            );
          })}

          <Link
            href="/home?compose=1"
            aria-label="Create post"
            className="mx-0.5 flex h-12 w-12 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-green)] text-white shadow-[0_8px_24px_rgba(87,193,255,0.25)] transition-transform active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={2.6} />
          </Link>

          {right.map(({ href, label, icon: Icon, color, activeBg }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium tracking-[0.2px] transition-colors ${
                  active
                    ? `${activeBg} text-white`
                    : "text-white/65 hover:text-white"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? "text-white" : color}`} strokeWidth={active ? 2.1 : 1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
