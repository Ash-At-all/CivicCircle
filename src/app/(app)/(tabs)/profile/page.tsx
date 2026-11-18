"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, Key, Copy, Check, Info, ArrowLeft, RefreshCw, FileText, Trash2 } from "lucide-react";
import { DefaultAvatar } from "@/components/ui/default-avatar";

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
    <div className="flex w-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-white/8 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 pt-[max(env(safe-area-inset-top),10px)] sm:px-5">
          <Link
            href="/home"
            className="btn btn-icon btn-secondary text-white/80"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
          <h1 className="text-sm font-medium tracking-[0.2px] text-[var(--ink)]">
            Profile &amp; settings
          </h1>
          <div className="w-9" aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-5 sm:px-6">
        {/* Profile Card */}
        <section className="card p-6">
          <div className="flex flex-col items-center text-center">
            <DefaultAvatar
              name={nickname || "Anonymous"}
              seed={clientId || nickname || "Anonymous"}
              size="xl"
              className="h-16 w-16 text-[20px]"
            />
            <h2 className="mt-3 text-h3">{nickname}</h2>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] tracking-[0.3px] text-[var(--mute)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-green)]" />
              Anonymous identity
            </p>
          </div>
        </section>

        {/* Change Nickname Section */}
        <section className="card p-5">
          <h3 className="text-label mb-3">Display nickname</h3>
          <form onSubmit={handleSaveNickname} className="space-y-2.5">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Your nickname"
              maxLength={24}
              required
              className="field"
            />
            <button type="submit" className="btn btn-primary w-full">
              {saved ? "Saved successfully!" : "Update nickname"}
            </button>
          </form>
        </section>

        {/* Security & Identity */}
        <section className="card space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--mute)]" strokeWidth={1.8} />
            <h3 className="text-label">Identity &amp; security</h3>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-3.5">
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="tracking-[0.3px] text-[var(--mute)]">Client ID</span>
              <button
                type="button"
                onClick={copyClientId}
                className="inline-flex items-center gap-1 font-medium text-[var(--body-text)] transition-colors hover:text-[var(--ink)]"
              >
                {copiedId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedId ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <p className="mt-1.5 truncate font-mono text-[11px] text-[var(--body-text)]">
              {clientId || "..."}
            </p>
          </div>

          <button
            type="button"
            onClick={exportKeys}
            className="btn btn-tertiary w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Key className="h-4 w-4 text-[var(--mute)]" strokeWidth={1.8} />
              <span>Backup identity</span>
            </span>
            <span className="text-[var(--mute)]">{copiedKey ? "Copied!" : "Export"}</span>
          </button>
        </section>

        {/* About & Legal */}
        <section className="card p-5">
          <h3 className="text-label mb-2">About CivicCircle</h3>
          <div className="divide-y divide-[var(--hairline)]">
            <div className="flex items-center justify-between gap-2 py-2.5 text-[13px] text-[var(--body-text)]">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 text-[var(--mute)]" strokeWidth={1.8} />
                <span>Version</span>
              </span>
              <span className="text-[var(--mute)]">1.0.0 (login-free)</span>
            </div>
            <Link
              href="/privacy"
              className="flex items-center justify-between gap-2 py-2.5 text-[13px] text-[var(--body-text)] transition-colors hover:text-[var(--ink)]"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--mute)]" strokeWidth={1.8} />
                <span>Privacy policy</span>
              </span>
              <span className="text-[var(--ash)]">→</span>
            </Link>
            <Link
              href="/terms"
              className="flex items-center justify-between gap-2 py-2.5 text-[13px] text-[var(--body-text)] transition-colors hover:text-[var(--ink)]"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--mute)]" strokeWidth={1.8} />
                <span>Terms of service</span>
              </span>
              <span className="text-[var(--ash)]">→</span>
            </Link>
          </div>
        </section>

        {/* Reset Identity */}
        <button
          type="button"
          onClick={resetIdentity}
          className="btn btn-tertiary w-full"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span>Generate new identity / reset</span>
        </button>

        {/* Delete Account */}
        <button
          type="button"
          onClick={deleteAccount}
          disabled={deleting}
          className="btn btn-danger w-full"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span>{deleting ? "Deleting..." : "Delete account"}</span>
        </button>

        <p className="pt-1 text-center text-[11px] tracking-[0.3px] text-[var(--ash)]">
          Everything is stored on this device. Clearing your browser data removes your identity.
        </p>
      </div>
    </div>
  );
}
