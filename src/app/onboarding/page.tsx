"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight } from "lucide-react";
import { CITIES } from "@/lib/cities";

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#AD68F5] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mobile-container min-h-[100dvh] bg-[#171921] text-[#FFFFFF] flex flex-col justify-between">
      {/* Top branding */}
      <div className="flex flex-col items-center pt-10 px-6 text-center">
        <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#F2F0FA]/10 p-0.5 border border-[#AD68F5]/30">
          <Image
            src="/logo.svg"
            alt="VibeChat Logo"
            width={48}
            height={48}
            className="drop-shadow-[0_0_12px_rgba(248,220,71,0.4)]"
            priority
          />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#FFFFFF] sm:text-2xl">
          Choose your topics
        </h1>
        <p className="mt-1 text-xs text-[#9CA3AF] max-w-[280px]">
          Pick what interests you. You can change this later.
        </p>
      </div>

      {/* Progress segments */}
      <div className="w-full px-6">
        <div className="flex w-full gap-1">
          {[1, 2].map((i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full bg-[#F2F0FA]/20" />
          ))}
        </div>
      </div>

      {/* Scattered rotated topic tags */}
      <div className="flex-1 px-6 pt-4">
        <div className="relative h-[300px]">
          {CITIES.map((topic, i) => {
            const color = TOPIC_COLORS[i % TOPIC_COLORS.length];
            const isSelected = selectedTopics.has(topic.slug);
            const rotate = -40 + (i * 13) % 105;
            let baseClass = "";
            if (color === "#FFFFFF") baseClass = "text-[#FFFFFF]";
            else if (color === "#AD68F5") baseClass = "text-[#AD68F5]";
            else if (color === "#F5B5ED") baseClass = "text-[#F5B5ED]";
            else baseClass = "text-[#FFE7BE]";
            const buttonClass = isSelected
              ? "absolute rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-tighter transition-all duration-200 bg-[#F8DC47] text-[#171921] shadow-lg"
              : `absolute rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-tighter transition-all duration-200 bg-[#1A1A2E] border border-[#F2F0FA]/20 ${baseClass}`;
            return (
              <button
                key={topic.slug}
                type="button"
                onClick={() => toggleTopic(topic.slug)}
                className={buttonClass}
                style={{
                  transform: `rotate(${rotate}deg) translate(${i * 18}px, ${i * 14}px)`,
                }}
                aria-pressed={isSelected}
              >
                {topic.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nickname input */}
      <form onSubmit={handleContinue} className="w-full px-6 space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="nickname" className="text-xs font-medium text-[#9CA3AF] ml-1">
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
            className="w-full rounded-xl border border-[#FFFFFF]/10 bg-[#1A1A2E]/80 px-4 py-3 text-sm text-[#FFFFFF] placeholder-[#6B7280] outline-none transition focus:border-[#AD68F5] focus:ring-1 focus:ring-[#AD68F5]"
          />
          <p className="text-[10px] text-[#6B7280] ml-1">
            You can change this anytime in profile settings.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !nickname.trim()}
          className="w-full bg-[#F8DC47] text-[#171921] font-bold py-3.5 rounded-xl items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <span>{loading ? "Setting up..." : "Continue"}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {/* Footer reassurance */}
      <div className="pb-4 px-6 text-center">
        <div className="inline-flex items-center justify-center gap-1.5 text-xs text-[#6B7280]">
          <Lock className="h-3.5 w-3.5 text-[#AD68F5]" />
          <span>No account needed. Chats are encrypted.</span>
        </div>
      </div>
    </div>
  );
}
