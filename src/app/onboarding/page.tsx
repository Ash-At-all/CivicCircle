"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, ChevronLeft, ShieldCheck } from "lucide-react";
import { CITIES } from "@/features/cities/cities";

const TOPIC_LABELS: Record<string, string> = {
  general: "General",
  "ask-civiccircle": "Ask CivicCircle",
  "food-dining": "Food & Dining",
  "jobs-careers": "Jobs & Careers",
  "housing-rent": "Housing & Rent",
  events: "Events",
  marketplace: "Marketplace",
  recommendations: "Recommendations",
  "tech-startups": "Tech & Startups",
  "fitness-health": "Fitness & Health",
  travel: "Travel",
  "local-news": "Local News",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [nickname, setNicknameInput] = useState(
    typeof window !== "undefined" ? localStorage.getItem("civiccircle-client-name") || "" : ""
  );
  const [loading, setLoading] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [ageVerified, setAgeVerified] = useState(
    typeof window !== "undefined" ? localStorage.getItem("civiccircle-age-verified") === "true" : false
  );

  useEffect(() => {
    const onboarded = typeof window !== "undefined" ? localStorage.getItem("civiccircle-onboarded") : null;
    if (onboarded === "true" && nickname && nickname !== "Anonymous" && ageVerified) {
      router.replace("/home");
      return;
    }
  }, [router, nickname, ageVerified]);

  function confirmAge() {
    setAgeVerified(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("civiccircle-age-verified", "true");
    }
  }

  function toggleTopic(slug: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    const chosenName = nickname.trim() || "Anonymous";
    setLoading(true);

    if (typeof window !== "undefined") {
      localStorage.setItem("civiccircle-client-name", chosenName);
      let id = localStorage.getItem("civiccircle-client-id");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("civiccircle-client-id", id);
      }
      localStorage.setItem("civiccircle-onboarded", "true");
    }
    router.push("/home");
  }

  return (
    <div className="mobile-container">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),16px)] sm:px-6">
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.back()}
          className="btn btn-icon btn-secondary text-[var(--mute)]"
        >
          <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        <span className="text-[11px] uppercase tracking-[0.4px] text-[var(--ash)]">CivicCircle</span>
        <div className="w-9" aria-hidden="true" />
      </header>

      {!ageVerified ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center sm:px-6">
          <span className="app-tile app-tile-lg mb-6 text-[var(--ink)]">
            <ShieldCheck className="h-7 w-7" strokeWidth={1.6} />
          </span>
          <h2 className="max-w-[22ch] text-display text-balance">Are you 18 or older?</h2>
          <p className="mx-auto mt-3 max-w-[34ch] text-body-sm leading-relaxed text-[var(--mute)]">
            CivicCircle is intended for adults aged 18 and over. By continuing, you confirm you
            are 18 or older.
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col gap-2.5">
            <button
              type="button"
              onClick={confirmAge}
              className="btn btn-primary btn-lg w-full"
            >
              Yes, I am 18 or older
            </button>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="btn btn-secondary btn-lg w-full"
            >
              No, take me back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-4 pb-6 sm:px-6">
          {/* Heading */}
          <div className="mx-auto mt-4 w-full max-w-xl">
            <p className="text-label">Getting started</p>
            <h1 className="mt-1 text-h1">Choose your topics</h1>
            <p className="mt-1.5 text-body-sm text-[var(--mute)]">
              Pick what you care about in your city. You can change this later.
            </p>
          </div>

          {/* Progress segments */}
          <div className="mx-auto mt-5 w-full max-w-xl">
            <div className="flex h-[3px] w-full gap-1.5">
              <div className="h-full flex-1 rounded-full bg-[var(--primary)]" />
              <div className="h-full flex-1 rounded-full bg-[var(--primary)]" />
              <div className="h-full flex-1 rounded-full bg-[var(--hairline)]" />
              <div className="h-full flex-1 rounded-full bg-[var(--hairline)]" />
            </div>
          </div>

          {/* Topic chips */}
          <div className="mx-auto mt-6 w-full max-w-xl">
            <div className="card p-4">
              <div className="flex flex-wrap gap-1.5">
                {CITIES.map((topic) => {
                  const isSelected = selectedTopics.has(topic.slug);
                  return (
                    <button
                      key={topic.slug}
                      type="button"
                      onClick={() => toggleTopic(topic.slug)}
                      className={`topic-chip ${isSelected ? "topic-chip--active" : "topic-chip--inactive"}`}
                      aria-pressed={isSelected}
                    >
                      {TOPIC_LABELS[topic.slug] || topic.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] tracking-[0.3px] text-[var(--ash)]">
                {selectedTopics.size === 0
                  ? "Optional — skip if you like."
                  : `${selectedTopics.size} selected`}
              </p>
            </div>
          </div>

          {/* Nickname input */}
          <form onSubmit={handleContinue} className="mx-auto mt-5 w-full max-w-xl space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="nickname" className="text-label ml-0.5 block">
                Your nickname
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="e.g. CyberVibe"
                maxLength={24}
                required
                className="field field-lg"
              />
              <p className="ml-0.5 text-[11px] tracking-[0.3px] text-[var(--ash)]">
                You can change this anytime in profile settings.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !nickname.trim()}
              className="btn btn-primary btn-lg w-full"
            >
              <span>{loading ? "Setting up..." : "Continue"}</span>
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>

          {/* Footer reassurance */}
          <div className="mx-auto mt-auto w-full max-w-xl pt-6 text-center">
            <div className="inline-flex items-center justify-center gap-1.5 text-[11px] tracking-[0.3px] text-[var(--mute)]">
              <Lock className="h-3.5 w-3.5 text-[var(--ash)]" strokeWidth={1.8} />
              <span>No account needed. Join your city and start talking.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
