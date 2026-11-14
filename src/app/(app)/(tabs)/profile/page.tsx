"use client";

import { useState } from "react";
import Link from "next/link";
import { User, Shield, Key, Copy, Check, Info, ArrowLeft, RefreshCw, FileText, Trash2 } from "lucide-react";

export default function ProfilePage() {
  const [nickname, setNickname] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("civiccircle-client-name") || "Anonymous"
      : "Anonymous",
  );
  const [clientId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("civiccircle-client-id") || "" : "",
  );
  const [saved, setSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleSaveNickname(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nickname.trim() || "Anonymous";
    if (typeof window !== "undefined") {
      localStorage.setItem("civiccircle-client-name", trimmed);
    }
    setNickname(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function copyClientId() {
    if (!clientId) return;
    navigator.clipboard.writeText(clientId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  function exportKeys() {
    const backupData = JSON.stringify({
      version: 1,
      clientId,
      nickname,
      exportedAt: new Date().toISOString(),
    }, null, 2);
    navigator.clipboard.writeText(backupData);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function deleteAccount() {
    if (!confirm("Are you sure you want to delete your account? This will permanently remove your nickname, client ID, and all local preferences. This cannot be undone.")) return;
    setDeleting(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem("civiccircle-client-id");
      localStorage.removeItem("civiccircle-client-name");
      localStorage.removeItem("civiccircle-onboarded");
      localStorage.removeItem("civiccircle-age-verified");
      localStorage.removeItem("civiccircle-joined-cities");
    }
    setTimeout(() => {
      setDeleting(false);
      window.location.href = "/";
    }, 500);
  }

  function resetIdentity() {
    if (confirm("Are you sure you want to generate a new identity? Your previous identity will be replaced.")) {
      localStorage.removeItem("civiccircle-client-id");
      localStorage.removeItem("civiccircle-client-name");
      localStorage.removeItem("civiccircle-onboarded");
      window.location.href = "/onboarding";
    }
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto radial-top-glow">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.08] bg-[#171921]/95 px-4 py-3.5 backdrop-blur-xl pt-[max(env(safe-area-inset-top),4px)]">
        <Link
          href="/home"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFFFFF]/06 text-[#F2F0FA] hover:text-[#FFFFFF] transition"
          aria-label="Back to feed"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-bold text-[#FFFFFF]">Profile & Settings</h1>
        <div className="w-9" />
      </header>

      <div className="px-4 py-5 space-y-5">
        {/* Profile Card */}
        <div className="glass-card rounded-2xl p-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-[#AD68F5] to-[#F5B5ED] p-0.5 shadow-[0_0_24px_rgba(173,104,245,0.4)]">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#1F2230]">
              <User className="h-9 w-9 text-[#AD68F5]" />
            </div>
          </div>
          <h2 className="mt-3 text-lg font-bold text-[#FFFFFF]">{nickname}</h2>
          <p className="text-xs text-[#AD68F5] font-medium">Anonymous Identity</p>
        </div>

        {/* Change Nickname Section */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-[#8B8FA3] uppercase tracking-wider mb-3">
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
              className="w-full rounded-xl border border-[#FFFFFF]/10 bg-[#161626] px-3.5 py-2.5 text-sm text-[#FFFFFF] placeholder-[#8B8FA3] outline-none focus:border-[#AD68F5] transition"
            />
            <button
              type="submit"
              className="gradient-btn flex w-full min-h-[42px] items-center justify-center rounded-xl font-medium text-xs text-[#FFFFFF]"
            >
              {saved ? "Saved successfully!" : "Update Nickname"}
            </button>
          </form>
        </div>

        {/* Security & Identity */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#AD68F5]" />
            <h3 className="text-xs font-semibold text-[#8B8FA3] uppercase tracking-wider">
              Identity & Security
            </h3>
          </div>

          <div className="rounded-xl border border-[#FFFFFF]/06 bg-black/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8B8FA3]">Client ID</span>
              <button
                type="button"
                onClick={copyClientId}
                className="inline-flex items-center gap-1 text-[#AD68F5] hover:text-[#F5B5ED] font-medium"
              >
                {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedId ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <p className="font-mono text-[11px] text-[#F1F4FF] truncate">{clientId || "..."}</p>
          </div>

          <button
            type="button"
            onClick={exportKeys}
            className="flex w-full min-h-[44px] items-center justify-between rounded-xl border border-[#FFFFFF]/10 bg-[#FFFFFF]/04 px-4 py-2.5 text-xs font-medium text-[#FFFFFF] hover:bg-[#FFFFFF]/08 transition"
          >
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-[#AD68F5]" />
              <span>Backup Identity</span>
            </div>
            <span className="text-[#AD68F5]">{copiedKey ? "Copied!" : "Export"}</span>
          </button>
        </div>

        {/* About & Legal */}
        <div className="glass-card rounded-2xl p-5 space-y-2.5">
          <h3 className="text-xs font-semibold text-[#8B8FA3] uppercase tracking-wider mb-2">
            About CivicCircle
          </h3>
          <div className="flex items-center justify-between py-1 text-xs text-[#F2F0FA]">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-[#8B8FA3]" />
              <span>Version</span>
            </span>
            <span className="text-[#8B8FA3]">1.0.0 (Login-free)</span>
          </div>
          <Link
            href="/privacy"
            className="flex items-center justify-between py-1 text-xs text-[#F2F0FA] hover:text-[#FFFFFF] transition"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#8B8FA3]" />
              <span>Privacy Policy</span>
            </span>
            <span className="text-[#8B8FA3]">→</span>
          </Link>
          <Link
            href="/terms"
            className="flex items-center justify-between py-1 text-xs text-[#F2F0FA] hover:text-[#FFFFFF] transition"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#8B8FA3]" />
              <span>Terms of Service</span>
            </span>
            <span className="text-[#8B8FA3]">→</span>
          </Link>
        </div>

        {/* Reset Identity */}
        <div className="pt-2">
          <button
            type="button"
            onClick={resetIdentity}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/10 text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/20 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Generate New Identity / Reset</span>
          </button>
        </div>

        {/* Delete Account */}
        <div className="pt-2">
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleting}
            className={`flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/10 text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/20 transition disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{deleting ? "Deleting..." : "Delete Account"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
