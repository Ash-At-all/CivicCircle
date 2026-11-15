"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Plus, MessageSquare, User } from "lucide-react";

const ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discovery", label: "Explore", icon: Compass },
  { href: "/chat/general", label: "Chats", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
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
        <div className="flex items-center justify-between gap-1 rounded-full border border-[var(--hairline)] bg-[rgba(13,13,13,0.92)] p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {left.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium tracking-[0.2px] transition-colors ${
                  active
                    ? "bg-[var(--surface-card)] text-[var(--on-dark)]"
                    : "text-[var(--mute)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.7} />
                <span>{label}</span>
              </Link>
            );
          })}

          <Link
            href="/home?compose=1"
            aria-label="Create post"
            className="mx-0.5 flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] transition-colors active:bg-[var(--primary-pressed)]"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </Link>

          {right.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium tracking-[0.2px] transition-colors ${
                  active
                    ? "bg-[var(--surface-card)] text-[var(--on-dark)]"
                    : "text-[var(--mute)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.7} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
