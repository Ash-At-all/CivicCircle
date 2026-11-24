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

  const renderItem = ({ href, label, icon: Icon }: (typeof ITEMS)[number]) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={`relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] text-[12px] transition-colors ${
          active
            ? "font-medium text-[var(--ink)]"
            : "text-[var(--mute)] hover:text-[var(--ink)]"
        }`}
      >
        {active ? (
          <span
            className="absolute top-0 h-[2px] w-5 bg-[var(--accent-ember)]"
            aria-hidden="true"
          />
        ) : null}
        <Icon
          className={`h-[19px] w-[19px] ${
            active ? "text-[var(--ink)]" : "text-[var(--ash)]"
          }`}
          strokeWidth={1.7}
        />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
    >
      <div className="mx-auto w-full max-w-md px-3 pb-[max(env(safe-area-inset-bottom),10px)]">
        <div className="flex items-center gap-1 rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-1.5">
          {left.map(renderItem)}

          <Link
            href="/home?compose=1"
            aria-label="Create post"
            className="mx-1 flex h-11 w-11 flex-none items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] text-[var(--on-primary)] transition-transform active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={2.2} />
          </Link>

          {right.map(renderItem)}
        </div>
      </div>
    </nav>
  );
}
