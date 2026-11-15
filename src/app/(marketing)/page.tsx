"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, MapPin, MessageSquare } from "lucide-react";

const HERO_MESSAGES = [
  "Your neighbourhood has a story. Be part of it.",
  "Something's always happening around you.",
  "Good things start with a conversation.",
  "Your local community starts here.",
  "Got something to say? Your neighbours are listening.",
  "Stay curious about your neighbourhood.",
  "A little local connection goes a long way.",
  "Know your area. Meet your community.",
  "What's happening around you today?",
  "Every neighbourhood has something to talk about.",
  "Your voice belongs in your community.",
  "New day, new conversations.",
  "There's more happening nearby than you think.",
  "Make your neighbourhood a little more connected.",
  "The best local updates come from locals.",
  "Small chats can spark big things nearby.",
  "See what's buzzing in your area.",
  "Drop in and say hi to your neighbours.",
  "Your corner of the city is worth knowing.",
  "Local tips, real people, right here.",
];

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Hey night owl";
}

function daySeed(date: Date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function dailyMessageIndex(seed: number, count: number) {
  let h = seed ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  const idx = h % count;
  if (count <= 1) return idx;
  const prevSeed = seed - 1;
  let ph = prevSeed ^ 0x9e3779b9;
  ph = Math.imul(ph ^ (ph >>> 16), 0x45d9f3b);
  ph = Math.imul(ph ^ (ph >>> 16), 0x45d9f3b);
  ph = (ph ^ (ph >>> 16)) >>> 0;
  const prevIdx = ph % count;
  return idx === prevIdx ? (idx + 1) % count : idx;
}

const FEATURES = [
  {
    icon: MessageSquare,
    title: "City boards",
    copy: "Post questions, updates and recommendations with tags, images and votes.",
  },
  {
    icon: MapPin,
    title: "Area rooms",
    copy: "Locality, ward and city chat, set an approximate area and drop in.",
  },
  {
    icon: Lock,
    title: "No account",
    copy: "A nickname is enough. Nothing to verify, no profile photo, no feed algorithm.",
  },
];

export default function RootPage() {
  const [heroPlace, setHeroPlace] = useState<string | null>(null);
  const [heroTick, setHeroTick] = useState(0);
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => {
    const readyId = window.setTimeout(() => setHeroReady(true), 0);
    const id = window.setInterval(() => setHeroTick((t) => t + 1), 60000);
    return () => {
      window.clearTimeout(readyId);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/area/nearby")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const name = typeof data.localityName === "string" ? data.localityName.trim() : "";
        if (name && name !== "Your area") setHeroPlace(name);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const heroGreeting = useMemo(() => {
    void heroTick;
    if (!heroReady) return "Your city, without the noise.";
    const now = new Date();
    const base = getGreeting(now.getHours());
    return heroPlace ? `${base}, ${heroPlace}!` : `${base}!`;
  }, [heroReady, heroPlace, heroTick]);

  const heroMessage = useMemo(() => {
    void heroTick;
    if (!heroReady) {
      return "City boards and live chat for your community. Post anonymously, follow the boards that matter, and talk to the people actually around you.";
    }
    const now = new Date();
    return HERO_MESSAGES[dailyMessageIndex(daySeed(now), HERO_MESSAGES.length)];
  }, [heroReady, heroTick]);

  return (
    <div className="relative isolate min-h-[100dvh] overflow-x-clip bg-[var(--canvas)]">
      <div className="hero-stripes" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-5 sm:px-8">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--hairline-strong)]">
              <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
            </span>
            <span className="text-sm font-medium tracking-[0.2px] text-[var(--ink)]">
              CivicCircle
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/privacy" className="btn btn-sm btn-secondary text-[var(--mute)]">
              Privacy
            </Link>
            <Link href="/onboarding" className="btn btn-sm btn-primary">
              Get started
            </Link>
          </div>
        </header>

        {/* Hero */}
        <main className="flex flex-1 flex-col justify-center py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--mute)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
                Now live in Chhatrapati Sambhajinagar
              </p>

              <h1 className="mt-5 max-w-[16ch] text-balance text-display">
                <span className="transition-opacity duration-500 ease-out">{heroGreeting}</span>
              </h1>

              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--body-text)] sm:text-base">
                <span className="transition-opacity duration-500 ease-out">{heroMessage}</span>
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <Link href="/onboarding" className="btn btn-primary btn-lg">
                  Get started
                </Link>
                <Link href="/home" className="btn btn-tertiary btn-lg">
                  Browse boards
                </Link>
              </div>

              <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] tracking-[0.3px] text-[var(--ash)]">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" strokeWidth={1.8} />
                  No account needed
                </span>
                <span aria-hidden="true">·</span>
                <span>Approximate area only</span>
                <span aria-hidden="true">·</span>
                <span>18+</span>
              </p>
            </div>

            {/* Command-palette mockup */}
            <div className="min-w-0">
              <div className="palette-card mx-auto w-full max-w-md">
                <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-3 py-2.5">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--stone)]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--stone)]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--stone)]" />
                  </span>
                  <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-2 py-1.5">
                    <svg
                      className="h-3.5 w-3.5 flex-none text-[var(--stone)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                    <span className="truncate text-[13px] text-[var(--stone)]">
                      What&apos;s happening nearby...
                    </span>
                  </div>
                </div>

                <div className="space-y-1 p-2">
                  <div className="palette-row palette-row-active">
                    <span className="app-tile h-8 w-8 min-h-0 border-0 bg-[var(--accent-blue-soft)] text-[var(--accent-blue)]">
                      <MapPin className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-[var(--ink)]">
                        Shops near you
                      </span>
                      <span className="block truncate text-[11px] text-[var(--mute)]">
                        Grocery, pharmacy, repair...
                      </span>
                    </span>
                    <span className="keycap">↵</span>
                  </div>

                  <div className="palette-row">
                    <span className="app-tile h-8 w-8 min-h-0 border-0 bg-[var(--accent-green-soft)] text-[var(--accent-green)]">
                      <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-[var(--ink)]">
                        Locality room
                      </span>
                      <span className="block truncate text-[11px] text-[var(--mute)]">
                        Ward and city rooms
                      </span>
                    </span>
                    <span className="keycap">⌘</span>
                    <span className="keycap">K</span>
                  </div>

                  <div className="palette-row">
                    <span className="app-tile h-8 w-8 min-h-0 border-0 bg-[var(--accent-yellow-soft)] text-[var(--accent-yellow)]">
                      <Lock className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-[var(--ink)]">
                        Post anonymously
                      </span>
                      <span className="block truncate text-[11px] text-[var(--mute)]">
                        No account, no email
                      </span>
                    </span>
                    <span className="keycap">N</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--hairline)] px-3 py-2 text-[11px] tracking-[0.3px] text-[var(--ash)]">
                  <span>Sambhajinagar</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
                    live
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Feature strip */}
        <section className="grid grid-cols-1 gap-3 pb-12 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, copy }) => (
            <div key={title} className="card p-4 sm:p-5">
              <span className="app-tile mb-3 h-9 w-9 min-h-0 text-[var(--ink)]">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              <h2 className="text-[15px] font-medium tracking-[0.2px] text-[var(--ink)]">
                {title}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--mute)]">{copy}</p>
            </div>
          ))}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] py-5 text-[11px] tracking-[0.3px] text-[var(--ash)]">
          <span>CivicCircle · Preview</span>
          <span className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-[var(--ink)]">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[var(--ink)]">
              Terms
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
