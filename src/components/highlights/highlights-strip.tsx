"use client";

import Link from "next/link";
import {
  Flame,
  MapPin,
  MessageCircle,
  Star,
  Store,
  TrendingUp,
} from "lucide-react";

export type HighlightIcon = "flame" | "map" | "chat" | "star" | "store" | "trend";
export type HighlightAccent = "blue" | "green" | "yellow" | "red";

export type HighlightItem = {
  id: string;
  title: string;
  detail?: string;
  href?: string;
  icon?: HighlightIcon;
  accent?: HighlightAccent;
};

const ICONS = {
  flame: Flame,
  map: MapPin,
  chat: MessageCircle,
  star: Star,
  store: Store,
  trend: TrendingUp,
} as const;

export function HighlightsStrip({
  items,
  title = "What's happening",
  subtitle,
  onSelect,
  className = "",
}: {
  items: HighlightItem[];
  title?: string;
  subtitle?: string;
  onSelect?: (id: string) => void;
  className?: string;
  glass?: boolean;
}) {
  return (
    <section className={className} aria-labelledby="highlights-title">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="highlights-title"
            className="dateline"
          >
            <span className="dateline-mark" aria-hidden="true" />
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-[12px] text-[var(--ash)]">{subtitle}</p>
          ) : null}
        </div>
        <span className="flex-none text-[12px] text-[var(--ash)]">Live</span>
      </div>

      {items.length === 0 ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] p-3.5">
          <span className="mt-0.5 h-1.5 w-1.5 flex-none bg-[var(--accent-ember)]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--ink)]">Quiet right now</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--mute)]">
              Start a post or check nearby to get things moving.
            </p>
          </div>
        </div>
      ) : (
        <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon ?? "trend"];
            const body = (
              <>
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] text-[var(--ash)]">
                  <Icon className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-[var(--ink)]">
                    {item.title}
                  </span>
                  {item.detail ? (
                    <span className="mt-0.5 block line-clamp-2 text-[12px] leading-relaxed text-[var(--mute)]">
                      {item.detail}
                    </span>
                  ) : null}
                </span>
              </>
            );

            const cardClass =
              "flex min-h-[70px] w-[228px] flex-none snap-start items-start gap-2.5 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface)] p-3 text-left transition-colors hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-elevated)]";

            if (onSelect) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cardClass}
                  onClick={() => onSelect(item.id)}
                >
                  {body}
                </button>
              );
            }

            if (item.href) {
              return (
                <Link key={item.id} href={item.href} className={cardClass}>
                  {body}
                </Link>
              );
            }

            return (
              <div key={item.id} className={cardClass}>
                {body}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
