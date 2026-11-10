"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, ChevronLeft } from "lucide-react";
import { CITIES } from "@/lib/cities";

const TOPIC_ICONS: Record<string, string> = {
  general: "GENERAL",
  "ask-vibechat": "ASK VIBECHAT",
  "food-dining": "FOOD & DINING",
  "jobs-careers": "JOBS & CAREERS",
  "housing-rent": "HOUSING & RENT",
  events: "EVENTS",
  marketplace: "MARKETPLACE",
  recommendations: "RECOMMENDATIONS",
  "tech-startups": "TECH & STARTUPS",
  "fitness-health": "FITNESS & HEALTH",
  travel: "TRAVEL",
  "local-news": "LOCAL NEWS",
};

const TOPIC_COLORS = ["#AD68F5", "#F5B5ED", "#FFE7BE", "#FFFFFF"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [nickname, setNicknameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onboarded = typeof window !== "undefined" ? localStorage.getItem("vibechat-onboarded") : null;
    const existingName = typeof window !== "undefined" ? localStorage.getItem("vibechat-client-name") : null;
    if (onboarded === "true" && existingName && existingName !== "Anonymous") {
      router.replace("/home");
      return;
    }
    if (existingName && existingName !== "Anonymous") {
      setNicknameInput(existingName);
    }
    setChecking(false);
  }, [router]);

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
      localStorage.setItem("vibechat-client-name", chosenName);
      let id = localStorage.getItem("vibechat-client-id");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("vibechat-client-id", id);
      }
      localStorage.setItem("vibechat-onboarded", "true");
    }
    router.push("/home");
  }

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#171921]">
        <div className="h-8 w-8 animate-[spin_1s_linear_infinite] rounded-full border-2 border-[#AD68F5] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mobile-container min-h-[100dvh] bg-[#171921] text-[#F2F0FA] flex flex-col justify-between px-4">
      {/* Top bar */}
      <header className="pt-6 flex items-center justify-between">
        <button
          type="button"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF]/06 text-[#F2F0FA] hover:bg-[#FFFFFF]/10 transition-all"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF]/06 text-[#F2F0FA]" />
      </header>

      {/* Heading */}
      <div className="text-center mt-8 px-4">
        <h1 className="text-h1 text-[#FFFFFF]">Choose your topics</h1>
        <p className="mt-2 text-[11px] text-[#8B8FA3] max-w-[280px] mx-auto">
          Pick what you care about in your city. You can change this later.
        </p>
      </div>

      {/* Progress segments */}
      <div className="px-4 mt-6">
        <div className="flex w-full gap-1.5 h-[3px]">
          <div className="flex-1 h-full rounded-full bg-[#FFE7BE]" />
          <div className="flex-1 h-full rounded-full bg-[#FFF3B8]" />
          <div className="flex-1 h-full rounded-full bg-[#FFFFFF]/10" />
          <div className="flex-1 h-full rounded-full bg-[#FFFFFF]/10" />
        </div>
      </div>

      {/* Scattered rotated topic tags */}
      <div className="flex-1 px-4 pt-6">
        <div className="relative h-[260px] w-full">
          {CITIES.map((topic, i) => {
            const color = TOPIC_COLORS[i % TOPIC_COLORS.length];
            const isSelected = selectedTopics.has(topic.slug);
            const rotate = -40 + (i * 13) % 105;
            const top = 20 + (i * 11) % 140;
            const left = 10 + (i * 17) % 160;
            let baseClass = "";
            if (color === "#FFFFFF") baseClass = "text-[#F2F0FA]";
            else if (color === "#AD68F5") baseClass = "text-[#AD68F5]";
            else if (color === "#F5B5ED") baseClass = "text-[#F5B5ED]";
            else baseClass = "text-[#171921]";
            const buttonClass = isSelected
              ? "absolute rounded-[999px] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-tight transition-all duration-200 bg-[#F8DC47] text-[#171921] ring-2 ring-[#FFFFFF] shadow-lg"
              : `absolute rounded-[999px] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-tight transition-all duration-200 bg-[#FFFFFF]/10 border border-[#FFFFFF]/20 ${baseClass}`;
            return (
              <button
                key={topic.slug}
                type="button"
                onClick={() => toggleTopic(topic.slug)}
                className={buttonClass}
                style={{ transform: `rotate(${rotate}deg)`, top, left }}
                aria-pressed={isSelected}
              >
                {TOPIC_ICONS[topic.slug] || topic.name.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nickname input */}
      <form onSubmit={handleContinue} className="px-4 space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="nickname" className="text-label text-[#8B8FA3] ml-1">
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
            className="w-full rounded-[20px] border border-[#FFFFFF]/10 bg-[#FFFFFF]/05 px-4 py-3.5 text-sm text-[#F2F0FA] placeholder-[#8B8FA3] outline-none transition-all focus:border-[#AD68F5] focus:ring-1 focus:ring-[#AD68F5]"
          />
          <p className="text-[10px] text-[#8B8FA3] ml-1">
            You can change this anytime in profile settings.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !nickname.trim()}
          className="w-full rounded-[16px] bg-[#F8DC47] text-[#171921] font-semibold text-base py-3.5 transition-all press-active disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{loading ? "Setting up..." : "Continue"}</span>
          <ArrowRight className="h-5 w-5 ml-2" />
        </button>
      </form>

      {/* Footer reassurance */}
      <div className="pb-6 px-4 text-center">
        <div className="inline-flex items-center justify-center gap-1.5 text-[11px] text-[#8B8FA3]">
          <Lock className="h-3.5 w-3.5 text-[#AD68F5]" />
          <span>No account needed. Chats are encrypted.</span>
        </div>
      </div>
    </div>
  );
}
