"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Lock, MapPin, MessageSquare, ShieldCheck, ThumbsUp } from "lucide-react";

const HERO_MESSAGES = [
  "Talk to neighbours, find local shops, share what's happening.",
  "Talk to your neighbours. No account needed.",
  "Local tips, real people, no sign-up forms.",
  "See what's buzzing nearby, without giving your name.",
  "Drop in, say hi, stay anonymous.",
];

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

  const heroMessage = useMemo(() => {
    void heroTick;
    if (!heroReady) {
      return "Talk to neighbours, find local shops, share what's happening - completely anonymous.";
    }
    const now = new Date();
    return HERO_MESSAGES[dailyMessageIndex(daySeed(now), HERO_MESSAGES.length)];
  }, [heroReady, heroTick]);

  const datelineLabel = heroReady
    ? new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "Today";

  return (
    <div className="relative isolate min-h-[100dvh] overflow-x-clip bg-[var(--canvas)]">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-5 sm:px-8">
        {/* Masthead */}
        <header className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] py-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="CivicCircle home">
            <Image
              src="/brand/logo.png"
              alt=""
              width={40}
              height={25}
              className="h-8 w-auto flex-none"
            />
            <span className="font-display text-[21px] leading-none text-[var(--ink)]">
              CivicCircle
            </span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Account">
            <Link href="/onboarding" className="btn btn-sm btn-primary">
              Get started
            </Link>
            <Link href="/privacy" className="btn btn-sm btn-secondary text-[var(--mute)]">
              Privacy
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <main className="flex flex-1 flex-col justify-center py-14 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
            <div className="min-w-0">
              <p className="dateline">
                <span className="dateline-mark" aria-hidden="true" />
                <span>{heroPlace ?? "Chhatrapati Sambhajinagar"}</span>
                <span className="dateline-sep" aria-hidden="true">·</span>
                <span>{datelineLabel}</span>
              </p>

              <h1 className="mt-4 max-w-[14ch] text-balance text-display">
                Notes from the neighbourhood.
              </h1>

              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--body-text)] sm:text-base">
                {heroMessage}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <Link href="/nearby" className="btn btn-primary">
                  See what&apos;s nearby
                </Link>
                <Link href="/home" className="btn btn-tertiary">
                  Browse boards
                </Link>
              </div>

              <ul className="mt-6 flex flex-col gap-1.5 text-[12px] text-[var(--ash)]">
                <li className="inline-flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                  No account needed
                </li>
                <li className="inline-flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                  Approximate location only
                </li>
                <li className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                  Ghost name, always
                </li>
              </ul>
            </div>

            {/* Printed notice + ballot */}
            <div className="min-w-0">
              <article className="mx-auto w-full max-w-md overflow-hidden rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-2.5">
                  <p className="dateline">
                    <span className="dateline-mark" aria-hidden="true" />
                    General
                  </p>
                  <span className="text-[12px] tabular-nums text-[var(--ash)]">Notice 014</span>
                </div>

                <div className="px-4 py-4">
                  <span className="tag-chip">Roads</span>
                  <h2 className="mt-2.5 font-display text-[24px] leading-[1.16] text-[var(--ink)]">
                    The lane behind the market is closed till Friday.
                  </h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--body-text)]">
                    Water works on the east side. Use the temple road entrance; autos are
                    rerouting via the school gate.
                  </p>
                  <div className="mt-3.5 flex items-center gap-3 text-[12px] text-[var(--ash)]">
                    <span className="inline-flex items-center gap-1.5">
                      <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                      12
                    </span>
                    <span>3 replies</span>
                    <span className="ml-auto">Anonymous</span>
                  </div>
                </div>

                <div className="border-t border-[var(--hairline)] bg-[var(--surface-elevated)] px-4 py-3.5">
                  <p className="dateline mb-2">
                    <span className="dateline-mark" aria-hidden="true" />
                    Ballot
                  </p>
                  <p className="text-[14px] font-medium leading-snug text-[var(--ink)]">
                    Should the market get a Sunday walking hour?
                  </p>
                  <div className="mt-2.5 space-y-2">
                    <div>
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="text-[var(--body-text)]">Yes, close it to traffic</span>
                        <span className="tabular-nums text-[var(--ash)]">62%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full bg-[var(--surface-card)]">
                        <div className="h-full w-[62%] bg-[var(--accent-ember)]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="text-[var(--body-text)]">No, keep it open</span>
                        <span className="tabular-nums text-[var(--ash)]">38%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full bg-[var(--surface-card)]">
                        <div className="h-full w-[38%] bg-[var(--stone)]" />
                      </div>
                    </div>
                  </div>
                  <p className="mt-2.5 text-[12px] text-[var(--ash)]">128 votes · Open</p>
                </div>
              </article>
            </div>
          </div>
        </main>

        {/* Feature list */}
        <section className="pb-12 sm:pb-16" aria-labelledby="features-title">
          <p id="features-title" className="dateline mb-5">
            <span className="dateline-mark" aria-hidden="true" />
            What you get
          </p>
          <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
            {FEATURES.map(({ icon: Icon, title, copy }, i) => (
              <div key={title} className="border-t border-[var(--hairline)] pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] tabular-nums text-[var(--ash)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon className="h-4 w-4 text-[var(--ash)]" strokeWidth={1.7} aria-hidden="true" />
                </div>
                <h2 className="mt-3 font-display text-[22px] leading-tight text-[var(--ink)]">
                  {title}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--mute)]">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-[var(--hairline)] py-6">
          <p className="max-w-xl text-[12px] leading-relaxed text-[var(--mute)]">
            CivicCircle never asks for your name, phone, or email. Your ghost handle keeps you
            anonymous.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--ash)]">
            <span>© CivicCircle</span>
            <span className="flex items-center gap-4">
              <Link href="/privacy" className="transition-colors hover:text-[var(--ink)]">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-[var(--ink)]">
                Terms
              </Link>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
