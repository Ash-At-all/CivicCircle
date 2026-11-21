"use client";

import Link from "next/link";
import {
  Flame,
  MapPin,
  MessageCircle,
  Sparkles,
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

const ACCENTS: Record<HighlightAccent, string> = {
  blue: "bg-[var(--accent-blue-soft)] text-[var(--accent-blue)]",
  green: "bg-[var(--accent-green-soft)] text-[var(--accent-green)]",
  yellow: "bg-[var(--accent-yellow-soft)] text-[var(--accent-yellow)]",
  red: "bg-[var(--accent-red-soft)] text-[var(--accent-red)]",
};

export function HighlightsStrip({
  items,
  title = "What's happening now",
  subtitle,
  onSelect,
  className = "",
  glass = false,
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
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="highlights-title"
            className={`inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.4px] ${
              glass ? "text-white/80" : "text-[var(--mute)]"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-[var(--accent-green)]" strokeWidth={1.8} aria-hidden="true" />
            {title}
          </h2>
          {subtitle ? (
            <p className={`mt-1 text-[11px] ${glass ? "text-white/55" : "text-[var(--ash)]"}`}>{subtitle}</p>
          ) : null}
        </div>
        <span
          className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.3px] ${
            glass
              ? "border-white/10 bg-white/6 text-white/60"
              : "border-[var(--hairline)] bg-[var(--surface)] text-[var(--ash)]"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" aria-hidden="true" />
          Live
        </span>
      </div>

      {items.length === 0 ? (
        <div
          className={`flex items-start gap-3 rounded-[var(--radius-lg)] border p-3.5 ${
            glass
              ? "border-white/10 bg-white/6"
              : "border-[var(--hairline)] bg-[var(--surface)]"
          }`}
        >
          <span className="app-tile h-9 w-9 flex-none text-[var(--accent-blue)]">
            <Sparkles className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className={`text-[13px] font-medium ${glass ? "text-white" : "text-[var(--ink)]"}`}>
              Quiet right now
            </p>
            <p className={`mt-0.5 text-[12px] leading-relaxed ${glass ? "text-white/60" : "text-[var(--mute)]"}`}>
              Start a post or check nearby to get things moving.
            </p>
          </div>
        </div>
      ) : (
        <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon ?? "trend"];
            const accent = ACCENTS[item.accent ?? "blue"];
            const body = (
              <>
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${accent}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[13px] font-semibold ${
                      glass ? "text-white" : "text-[var(--ink)]"
                    }`}
                  >
                    {item.title}
                  </span>
                  {item.detail ? (
                    <span
                      className={`mt-0.5 block line-clamp-2 text-[11px] leading-relaxed ${
                        glass ? "text-white/60" : "text-[var(--mute)]"
                      }`}
                    >
                      {item.detail}
                    </span>
                  ) : null}
                </span>
              </>
            );

            const cardClass = `flex min-h-[74px] w-[228px] flex-none snap-start items-start gap-2.5 rounded-[var(--radius-lg)] border p-3 text-left transition-colors ${
              glass
                ? "border-white/10 bg-white/6 hover:bg-white/10"
                : "border-[var(--hairline)] bg-[var(--surface)] hover:border-[var(--hairline-strong)]"
            }`;

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
