"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Sparkles } from "lucide-react";
import { getAnonId, getDisplayName, setDisplayName } from "@/lib/anon-identity";

export default function OnboardingPage() {
  const router = useRouter();
  const [nickname, setNicknameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if nickname + key/identity already exists in localStorage
    const onboarded = typeof window !== "undefined" ? localStorage.getItem("vibechat-onboarded") : null;
    const existingName = typeof window !== "undefined" ? localStorage.getItem("vibechat-display-name") : null;
    if (onboarded === "true" && existingName && existingName !== "Anonymous") {
      router.replace("/home");
      return;
    }
    const current = getDisplayName();
    if (current && current !== "Anonymous") {
      setNicknameInput(current);
    }
    setChecking(false);
  }, [router]);

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    const chosenName = nickname.trim() || "Anonymous";
    setLoading(true);
    setDisplayName(chosenName);
    getAnonId(); // ensure anon id is generated
    if (typeof window !== "undefined") {
      localStorage.setItem("vibechat-onboarded", "true");
    }
    router.push("/home");
  }

  if (checking) {
    return (
      <div className="mobile-container flex items-center justify-center bg-[#0B0B14]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mobile-container min-h-[100dvh] justify-between p-6 radial-top-glow">
      {/* Top branding & ambient glow */}
      <div className="flex flex-col items-center pt-16 text-center">
        {/* Glow Logo Container */}
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-b from-purple-500/20 to-transparent p-0.5 shadow-[0_0_40px_rgba(168,85,247,0.35)]">
          <div className="flex h-full w-full items-center justify-center rounded-3xl bg-[#121220]/90 backdrop-blur-md border border-purple-500/30">
            <Image
              src="/logo.svg"
              alt="VibeChat Logo"
              width={56}
              height={56}
              className="drop-shadow-[0_0_12px_rgba(168,85,247,0.8)]"
              priority
            />
          </div>
        </div>

        {/* Tagline */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <span>Hyperlocal & Encrypted</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Welcome to VibeChat
        </h1>
        <p className="mt-2 text-sm text-gray-400 max-w-[280px]">
          Anonymous, real-time conversations with people around you.
        </p>
      </div>

      {/* Center Form */}
      <form onSubmit={handleContinue} className="w-full space-y-4 my-auto">
        <div className="space-y-1.5">
          <label htmlFor="nickname" className="text-xs font-medium text-gray-300 ml-1">
            Choose your nickname
          </label>
          <div className="relative">
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="e.g. CyberVibe, NeonFox"
              maxLength={24}
              required
              className="w-full rounded-2xl border border-white/10 bg-[#161626]/80 px-4 py-3.5 text-sm text-white placeholder-gray-500 backdrop-blur-md outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <p className="text-[11px] text-gray-500 ml-1">
            You can change this anytime in profile settings.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !nickname.trim()}
          className="gradient-btn flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl font-semibold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <span>{loading ? "Setting up..." : "Continue"}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {/* Footer reassurance */}
      <div className="pb-4 text-center">
        <div className="inline-flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <Lock className="h-3.5 w-3.5 text-purple-400" />
          <span>No account needed. Chats are end-to-end encrypted.</span>
        </div>
      </div>
    </div>
  );
}
