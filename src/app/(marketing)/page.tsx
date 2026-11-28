"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Lock,
  Map,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Store,
} from "lucide-react";
import { DefaultAvatar } from "@/components/ui/default-avatar";

const NAV_ITEMS = [
  { href: "/nearby", label: "Nearby" },
  { href: "/discovery", label: "Map" },
  { href: "/nearby", label: "Shops" },
  { href: "/home#community-feed", label: "Polls" },
  { href: "/chat/general", label: "Community" },
] as const;

const FEATURES = [
  {
    icon: MapPin,
    title: "Nearby",
    copy: "See what's around you.",
    href: "/nearby",
  },
  {
    icon: Store,
    title: "Shops",
    copy: "Discover local shops.",
    href: "/nearby",
  },
  {
    icon: BarChart3,
    title: "Polls",
    copy: "Share your opinion.",
    href: "/home#community-feed",
  },
  {
    icon: Map,
    title: "Map",
    copy: "Explore your area.",
    href: "/discovery",
  },
] as const;

const MEMBERS = ["quiet_peepal", "auto_wale", "chai_adda", "gully_cricket"] as const;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1db954] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]";

function NeighbourhoodSkyline({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 220"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="1200" height="220" fill="#181818" />

      {/* Distant blocks */}
      <g fill="#1b1b1b">
        <rect x="0" y="98" width="118" height="98" />
        <rect x="140" y="72" width="84" height="124" />
        <rect x="250" y="104" width="110" height="92" />
        <rect x="390" y="60" width="86" height="136" />
        <rect x="500" y="92" width="128" height="104" />
        <rect x="660" y="54" width="92" height="142" />
        <rect x="780" y="86" width="118" height="110" />
        <rect x="930" y="66" width="82" height="130" />
        <rect x="1040" y="98" width="160" height="98" />
      </g>

      {/* Distant windows */}
      <g fill="#1db954" opacity="0.16">
        <rect x="158" y="88" width="7" height="9" />
        <rect x="178" y="88" width="7" height="9" />
        <rect x="198" y="88" width="7" height="9" />
        <rect x="158" y="108" width="7" height="9" />
        <rect x="178" y="108" width="7" height="9" />
        <rect x="198" y="108" width="7" height="9" />
        <rect x="408" y="78" width="7" height="9" />
        <rect x="428" y="78" width="7" height="9" />
        <rect x="448" y="78" width="7" height="9" />
        <rect x="408" y="98" width="7" height="9" />
        <rect x="428" y="98" width="7" height="9" />
        <rect x="678" y="72" width="7" height="9" />
        <rect x="698" y="72" width="7" height="9" />
        <rect x="718" y="72" width="7" height="9" />
        <rect x="678" y="92" width="7" height="9" />
        <rect x="718" y="92" width="7" height="9" />
        <rect x="948" y="84" width="7" height="9" />
        <rect x="968" y="84" width="7" height="9" />
        <rect x="948" y="104" width="7" height="9" />
        <rect x="968" y="104" width="7" height="9" />
        <rect x="1064" y="116" width="7" height="9" />
        <rect x="1084" y="116" width="7" height="9" />
        <rect x="1104" y="116" width="7" height="9" />
        <rect x="1124" y="116" width="7" height="9" />
      </g>

      {/* Rooftop details */}
      <g fill="#202020" stroke="#2e2e2e" strokeWidth="2">
        <rect x="160" y="60" width="20" height="12" />
        <rect x="404" y="48" width="24" height="12" />
        <rect x="680" y="42" width="24" height="12" />
        <rect x="944" y="54" width="20" height="12" />
      </g>

      {/* Front row buildings */}
      <g fill="#202020" stroke="#303030" strokeWidth="2">
        <rect x="24" y="142" width="136" height="54" rx="2" />
        <rect x="172" y="132" width="112" height="64" rx="2" />
        <rect x="296" y="150" width="128" height="46" rx="2" />
        <rect x="436" y="124" width="138" height="72" rx="2" />
        <rect x="586" y="142" width="150" height="54" rx="2" />
        <rect x="748" y="132" width="122" height="64" rx="2" />
        <rect x="882" y="148" width="132" height="48" rx="2" />
        <rect x="1026" y="134" width="150" height="62" rx="2" />
      </g>

      {/* Pitched roofs */}
      <g fill="#242424" stroke="#303030" strokeWidth="2">
        <path d="M172 132 L228 106 L284 132 Z" />
        <path d="M436 124 L505 92 L574 124 Z" />
        <path d="M882 148 L948 120 L1014 148 Z" />
      </g>

      {/* Shop awnings */}
      <g fill="#1db954" opacity="0.45">
        <rect x="40" y="158" width="104" height="6" />
        <rect x="312" y="164" width="96" height="6" />
        <rect x="602" y="158" width="118" height="6" />
        <rect x="1042" y="150" width="118" height="6" />
      </g>

      {/* Doors */}
      <g fill="#151515">
        <rect x="86" y="176" width="14" height="20" />
        <rect x="222" y="172" width="14" height="24" />
        <rect x="494" y="168" width="16" height="28" />
        <rect x="650" y="176" width="14" height="20" />
        <rect x="802" y="172" width="14" height="24" />
        <rect x="1100" y="172" width="14" height="24" />
      </g>

      {/* Lit windows */}
      <g fill="#1db954">
        <rect x="52" y="168" width="8" height="8" opacity="0.75" />
        <rect x="70" y="168" width="8" height="8" opacity="0.4" />
        <rect x="106" y="168" width="8" height="8" opacity="0.55" />
        <rect x="188" y="146" width="8" height="8" opacity="0.7" />
        <rect x="208" y="146" width="8" height="8" opacity="0.35" />
        <rect x="248" y="146" width="8" height="8" opacity="0.6" />
        <rect x="328" y="160" width="8" height="8" opacity="0.5" />
        <rect x="348" y="160" width="8" height="8" opacity="0.75" />
        <rect x="386" y="160" width="8" height="8" opacity="0.35" />
        <rect x="456" y="138" width="8" height="8" opacity="0.7" />
        <rect x="476" y="138" width="8" height="8" opacity="0.45" />
        <rect x="530" y="138" width="8" height="8" opacity="0.6" />
        <rect x="456" y="158" width="8" height="8" opacity="0.35" />
        <rect x="530" y="158" width="8" height="8" opacity="0.7" />
        <rect x="618" y="154" width="8" height="8" opacity="0.55" />
        <rect x="638" y="154" width="8" height="8" opacity="0.7" />
        <rect x="688" y="154" width="8" height="8" opacity="0.4" />
        <rect x="766" y="146" width="8" height="8" opacity="0.7" />
        <rect x="786" y="146" width="8" height="8" opacity="0.4" />
        <rect x="826" y="146" width="8" height="8" opacity="0.6" />
        <rect x="906" y="160" width="8" height="8" opacity="0.5" />
        <rect x="926" y="160" width="8" height="8" opacity="0.75" />
        <rect x="966" y="160" width="8" height="8" opacity="0.35" />
        <rect x="1052" y="148" width="8" height="8" opacity="0.65" />
        <rect x="1072" y="148" width="8" height="8" opacity="0.4" />
        <rect x="1112" y="148" width="8" height="8" opacity="0.55" />
        <rect x="1132" y="148" width="8" height="8" opacity="0.7" />
      </g>

      {/* Trees */}
      <g>
        <rect x="150" y="176" width="3" height="20" fill="#2c2c2c" />
        <circle cx="151" cy="168" r="14" fill="#17351f" />
        <circle cx="141" cy="176" r="10" fill="#17351f" />
        <circle cx="161" cy="176" r="10" fill="#17351f" />

        <rect x="596" y="178" width="3" height="18" fill="#2c2c2c" />
        <circle cx="597" cy="170" r="12" fill="#17351f" />
        <circle cx="588" cy="177" r="9" fill="#17351f" />
        <circle cx="606" cy="177" r="9" fill="#17351f" />

        <rect x="1004" y="176" width="3" height="20" fill="#2c2c2c" />
        <circle cx="1005" cy="168" r="14" fill="#17351f" />
        <circle cx="995" cy="176" r="10" fill="#17351f" />
        <circle cx="1015" cy="176" r="10" fill="#17351f" />
      </g>

      {/* Street lamps */}
      <g stroke="#3a3a3a" strokeWidth="2">
        <line x1="286" y1="196" x2="286" y2="156" />
        <line x1="736" y1="196" x2="736" y2="150" />
        <line x1="1006" y1="196" x2="1006" y2="154" />
      </g>
      <g fill="#1db954">
        <circle cx="286" cy="153" r="3" opacity="0.9" />
        <circle cx="736" cy="147" r="3" opacity="0.9" />
        <circle cx="1006" cy="151" r="3" opacity="0.9" />
      </g>

      {/* Ground */}
      <rect y="196" width="1200" height="24" fill="#151515" />
      <path d="M0 196H1200" stroke="#303030" strokeWidth="2" />
      <g stroke="#2a2a2a" strokeWidth="2" strokeDasharray="14 18">
        <line x1="20" y1="208" x2="1180" y2="208" />
      </g>
    </svg>
  );
}

export default function RootPage() {
  const [heroPlace, setHeroPlace] = useState<string | null>(null);

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

  return (
    <div className="min-h-[100dvh] bg-[#121212] text-white">
      <header className="sticky top-0 z-40 border-b border-[#303030] bg-[#121212]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5 sm:px-8">
          <Link
            href="/"
            className={`flex items-center gap-2.5 rounded-[8px] ${FOCUS_RING}`}
            aria-label="CivicCircle home"
          >
            <Image
              src="/brand/logo.png"
              alt=""
              width={32}
              height={20}
              priority
              className="h-7 w-auto flex-none"
            />
            <span className="hidden font-sans text-[19px] font-semibold leading-none tracking-[-0.01em] text-white min-[360px]:inline">
              CivicCircle
            </span>
          </Link>

          <nav className="ml-5 hidden items-center gap-0.5 md:flex" aria-label="Primary">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                className={`rounded-[8px] px-3 py-2 text-[14px] text-[#b3b3b3] transition-colors hover:bg-[#181818] hover:text-white ${FOCUS_RING}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/discovery"
              aria-label="Search CivicCircle"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#303030] text-[#b3b3b3] transition-colors hover:border-[#4a4a4a] hover:text-white ${FOCUS_RING}`}
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </Link>
            <Link
              href="/onboarding"
              className={`inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[10px] bg-[#1db954] px-3 text-[14px] font-semibold text-black transition-colors hover:bg-[#1ed760] min-[360px]:px-4 ${FOCUS_RING}`}
            >
              Get Started
            </Link>
          </div>
        </div>

        <nav
          className="no-scrollbar mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto border-t border-[#303030] px-3 py-2 md:hidden"
          aria-label="Primary mobile"
        >
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className={`whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[13px] text-[#b3b3b3] transition-colors hover:bg-[#181818] hover:text-white ${FOCUS_RING}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-14 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:pb-20 lg:pt-20">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[12px] font-medium text-[#b3b3b3]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1db954]" aria-hidden="true" />
              Your neighbourhood, online
            </p>

            <h1 className="mt-5 max-w-[13ch] text-balance font-sans text-[36px] font-bold leading-[1.02] tracking-[-0.035em] text-white min-[380px]:text-[42px] sm:text-[54px] lg:text-[62px]">
              Notes from the <span className="text-[#1db954]">neighbourhood</span>.
            </h1>

            <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-[#b3b3b3] sm:text-[17px]">
              Chat, share and stay connected with your local community on CivicCircle.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/onboarding"
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#1db954] px-6 text-[15px] font-semibold text-black transition-colors hover:bg-[#1ed760] ${FOCUS_RING}`}
              >
                Join the Community
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </Link>
              <Link
                href="/nearby"
                className={`inline-flex h-12 items-center justify-center rounded-[10px] border border-[#303030] px-6 text-[15px] font-semibold text-white transition-colors hover:border-[#4a4a4a] hover:bg-[#181818] ${FOCUS_RING}`}
              >
                Explore Nearby
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[#b3b3b3]">
              <li className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                No account needed
              </li>
              <li className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                Approximate area only
              </li>
              <li className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                Ghost handle, always
              </li>
            </ul>

            <div className="mt-8 flex items-center gap-3 border-t border-[#303030] pt-6">
              <div className="flex -space-x-2" aria-hidden="true">
                {MEMBERS.map((name) => (
                  <DefaultAvatar
                    key={name}
                    name={name}
                    size="sm"
                    className="ring-2 ring-[#121212]"
                  />
                ))}
                <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full border border-[#303030] bg-[#242424] text-[10px] font-medium text-[#b3b3b3] ring-2 ring-[#121212]">
                  +1.2k
                </span>
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1db954]" aria-hidden="true" />
                  1,200+ neighbours nearby
                </p>
                <p className="truncate text-[12px] text-[#b3b3b3]">
                  {heroPlace ? `Around ${heroPlace}` : "Around your area"}
                </p>
              </div>
            </div>
          </div>

          {/* Local update */}
          <div className="min-w-0">
            <p className="mb-3 inline-flex items-center gap-2 text-[12px] text-[#b3b3b3]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1db954]" aria-hidden="true" />
              Local update
            </p>

            <article className="rounded-[18px] border border-[#303030] bg-[#181818] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[20px] font-semibold leading-snug tracking-[-0.01em] text-white sm:text-[22px]">
                  GTA 6 PC at 4K 120 FPS, patched by Claude Opus 5.5 and Fable 5.2
                </h2>
                <span className="flex-none rounded-[6px] border border-[#303030] px-2 py-1 text-[10px] font-medium text-[#b3b3b3]">
                  1 day ago
                </span>
              </div>

              <p className="mt-3 text-[14px] leading-relaxed text-[#e8e8e8]">
                A new clip claims the PC build is running at 4K 120 FPS after the patch. If it
                holds up, Rockstar has a lot to answer for.
              </p>

              <div className="mt-5 flex items-center gap-4 border-t border-[#303030] pt-4 text-[12px] text-[#b3b3b3]">
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  Source: Reddit
                </span>
                <Link
                  href="/chat/general"
                  className={`ml-auto inline-flex items-center gap-1 rounded-[6px] text-[12px] font-medium text-[#1db954] transition-colors hover:text-[#1ed760] ${FOCUS_RING}`}
                >
                  Discuss
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </article>
          </div>
        </section>

        {/* Neighbourhood illustration */}
        <section
          className="mx-auto w-full max-w-6xl px-5 pb-14 sm:px-8 lg:pb-20"
          aria-label="Neighbourhood illustration"
        >
          <div className="overflow-hidden rounded-[20px] border border-[#303030] bg-[#181818]">
            <div className="flex items-center justify-between gap-3 border-b border-[#303030] px-4 py-3 sm:px-5">
              <p className="inline-flex items-center gap-2 text-[12px] text-[#b3b3b3]">
                <MapPin className="h-3.5 w-3.5 text-[#1db954]" strokeWidth={1.8} aria-hidden="true" />
                {heroPlace ?? "Your neighbourhood"}
              </p>
              <p className="inline-flex items-center gap-2 text-[12px] text-[#b3b3b3]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1db954]" aria-hidden="true" />
                Live
              </p>
            </div>
            <NeighbourhoodSkyline className="h-[140px] w-full sm:h-[180px] lg:h-[200px]" />
          </div>
        </section>

        {/* Features */}
        <section
          className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 lg:pb-24"
          aria-labelledby="features-heading"
        >
          <div className="max-w-xl">
            <p className="text-[12px] font-medium text-[#1db954]">What&apos;s inside</p>
            <h2
              id="features-heading"
              className="mt-2 font-sans text-[28px] font-bold tracking-[-0.02em] text-white sm:text-[34px]"
            >
              Built around your street.
            </h2>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, copy, href }) => (
              <Link
                key={title}
                href={href}
                className={`group rounded-[14px] border border-[#303030] bg-[#181818] p-5 transition-colors hover:border-[#1db954]/40 hover:bg-[#1c1c1c] ${FOCUS_RING}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#1db954]/10 text-[#1db954] transition-colors group-hover:bg-[#1db954]/15">
                  <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-white">{title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[#b3b3b3]">{copy}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#303030]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/logo.png"
              alt=""
              width={28}
              height={18}
              className="h-6 w-auto flex-none"
            />
            <div>
              <p className="font-sans text-[15px] font-semibold leading-none text-white">CivicCircle</p>
              <p className="mt-1 text-[12px] leading-none text-[#b3b3b3]">
                Notes from the neighbourhood.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[#b3b3b3]">
            <span>© CivicCircle</span>
            <Link
              href="/privacy"
              className={`rounded-[6px] transition-colors hover:text-white ${FOCUS_RING}`}
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className={`rounded-[6px] transition-colors hover:text-white ${FOCUS_RING}`}
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
