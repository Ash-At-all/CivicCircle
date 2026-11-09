"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Shield, Key, Copy, Check, Info, ArrowLeft, RefreshCw, FileText } from "lucide-react";
import { getAnonId, getDisplayName, setDisplayName } from "@/lib/anon-identity";

export default function ProfilePage() {
  const [nickname, setNickname] = useState("Anonymous");
  const [anonId, setAnonId] = useState("");
  const [saved, setSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    setNickname(getDisplayName());
    setAnonId(getAnonId());
  }, []);

  function handleSaveNickname(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nickname.trim() || "Anonymous";
    setDisplayName(trimmed);
    setNickname(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function copyAnonId() {
    if (!anonId) return;
    navigator.clipboard.writeText(anonId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  function exportKeys() {
    const backupData = JSON.stringify({
      version: 1,
      anonId,
      nickname,
      exportedAt: new Date().toISOString(),
      e2ee: "Curve25519-AES-GCM",
    }, null, 2);
    navigator.clipboard.writeText(backupData);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function resetIdentity() {
    if (confirm("Are you sure you want to generate a new anonymous identity? Your previous identity and keys will be replaced.")) {
      localStorage.removeItem("vibechat-anon-id");
      localStorage.removeItem("vibechat-display-name");
      localStorage.removeItem("vibechat-onboarded");
      window.location.href = "/onboarding";
    }
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto radial-top-glow">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.08] bg-[#0B0B14]/85 px-4 py-3.5 backdrop-blur-xl">
        <Link
          href="/home"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-gray-300 hover:text-white transition md:hidden"
          aria-label="Back to feed"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-bold text-white">Profile & Settings</h1>
        <div className="w-9 md:hidden" />
      </header>

      <div className="px-4 py-5 space-y-5">
        {/* Profile Card */}
        <div className="glass-card rounded-2xl p-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-violet-400 p-0.5 shadow-[0_0_24px_rgba(168,85,247,0.4)]">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#121220]">
              <User className="h-9 w-9 text-purple-400" />
            </div>
          </div>
          <h2 className="mt-3 text-lg font-bold text-white">{nickname}</h2>
          <p className="text-xs text-purple-300 font-medium">Anonymous Identity</p>
        </div>

        {/* Change Nickname Section */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Display Nickname
          </h3>
          <form onSubmit={handleSaveNickname} className="space-y-3">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Your nickname"
              maxLength={24}
              required
              className="w-full rounded-xl border border-white/10 bg-[#161626] px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500 transition"
            />
            <button
              type="submit"
              className="gradient-btn flex w-full min-h-[42px] items-center justify-center rounded-xl font-medium text-xs text-white"
            >
              {saved ? "Saved successfully!" : "Update Nickname"}
            </button>
          </form>
        </div>

        {/* Security & Cryptographic Identity */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-400" />
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              E2E Encryption & Security
            </h3>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Anonymous ID</span>
              <button
                type="button"
                onClick={copyAnonId}
                className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-medium"
              >
                {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedId ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <p className="font-mono text-[11px] text-gray-300 truncate">{anonId || "..."}</p>
          </div>

          <button
            type="button"
            onClick={exportKeys}
            className="flex w-full min-h-[44px] items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-white hover:bg-white/[0.08] transition"
          >
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-purple-400" />
              <span>Backup Encryption Identity</span>
            </div>
            <span className="text-purple-400">{copiedKey ? "Copied!" : "Export"}</span>
          </button>
        </div>

        {/* About & Legal */}
        <div className="glass-card rounded-2xl p-5 space-y-2.5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            About VibeChat
          </h3>
          <div className="flex items-center justify-between py-1 text-xs text-gray-300">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-gray-400" />
              <span>Version</span>
            </span>
            <span className="text-gray-500">1.0.0 (Login-free)</span>
          </div>
          <Link
            href="/privacy"
            className="flex items-center justify-between py-1 text-xs text-gray-300 hover:text-white transition"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span>Privacy Policy</span>
            </span>
            <span className="text-gray-500">→</span>
          </Link>
          <Link
            href="/terms"
            className="flex items-center justify-between py-1 text-xs text-gray-300 hover:text-white transition"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span>Terms of Service</span>
            </span>
            <span className="text-gray-500">→</span>
          </Link>
        </div>

        {/* Reset Identity */}
        <div className="pt-2">
          <button
            type="button"
            onClick={resetIdentity}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Generate New Identity / Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
