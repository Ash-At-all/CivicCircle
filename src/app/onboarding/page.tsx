"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { AreaPicker } from "@/components/area/area-picker";
import { generateGhostHandle } from "@/lib/auth/ghost";
import { findCityForCoords } from "@/features/area/cities";

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [ageVerified, setAgeVerified] = useState(
    typeof window !== "undefined" ? localStorage.getItem("civiccircle-age-verified") === "true" : false
  );
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaLabel, setAreaLabel] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [ghostName, setGhostName] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const existing = localStorage.getItem("civiccircle-client-name");
      return existing && existing !== "Anonymous" ? existing : "";
    } catch {
      return "";
    }
  });
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const onboarded = typeof window !== "undefined" ? localStorage.getItem("civiccircle-onboarded") : null;
    if (onboarded === "true" && ageVerified) {
      router.replace("/home");
    }
  }, [router, ageVerified]);

  const stepTitle = useMemo(() => {
    if (step === 1) return "Set your area";
    if (step === 2) return "Get a ghost name";
    return "Start talking";
  }, [step]);

  function confirmAge() {
    setAgeVerified(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("civiccircle-age-verified", "true");
    }
  }

  async function resolveFromCoords(lat: number, lng: number, citySlug: string) {
    const h3 = await import("h3-js");
    const h3r8 = h3.latLngToCell(lat, lng, 8);
    const h3r7 = h3.cellToParent(h3r8, 7);
    const res = await fetch("/api/area/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ h3r8, h3r7, city: citySlug }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error || "Could not set your area.");
    const name = (json as { area?: { locality?: { name?: string } } })?.area?.locality?.name;
    setAreaLabel(name || "Your area");
    setShowPicker(false);
    setStep(2);
  }

  async function locateFromGeolocation() {
    setBusy(true);
    setError(null);
    try {
      if (!("geolocation" in navigator)) throw new Error("Location is not available in this browser.");
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000,
        }),
      );
      const city = findCityForCoords(position.coords.latitude, position.coords.longitude);
      if (!city) {
        throw new Error("CivicCircle is not available in this city yet.");
      }
      await resolveFromCoords(position.coords.latitude, position.coords.longitude, city.slug);
    } catch (e) {
      const message =
        e instanceof GeolocationPositionError
          ? "Could not access your location. You can choose manually."
          : e instanceof Error
            ? e.message
            : "Could not set your area.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function revealGhost() {
    const next = ghostName || generateGhostHandle();
    setGhostName(next);
    try {
      localStorage.setItem("civiccircle-client-name", next);
      let id = localStorage.getItem("civiccircle-client-id");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("civiccircle-client-id", id);
      }
    } catch {}
    setRevealed(true);
  }

  function finish() {
    try {
      localStorage.setItem("civiccircle-onboarded", "true");
      if (ghostName) localStorage.setItem("civiccircle-client-name", ghostName);
      let id = localStorage.getItem("civiccircle-client-id");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("civiccircle-client-id", id);
      }
    } catch {}
    router.push("/home");
  }

  return (
    <div className="mobile-container">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),16px)] sm:px-6">
        <button
          type="button"
          aria-label="Back"
          onClick={() => (step > 1 ? setStep((s) => (s - 1) as Step) : router.back())}
          className="btn btn-icon btn-secondary text-[var(--mute)]"
        >
          <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        <span className="text-[12px] text-[var(--ash)]">CivicCircle</span>
        <div className="w-9" aria-hidden="true" />
      </header>

      {!ageVerified ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center sm:px-6">
          <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink)]">
            <ShieldCheck className="h-7 w-7" strokeWidth={1.6} />
          </span>
          <h2 className="max-w-[22ch] text-display text-balance">Are you 18 or older?</h2>
          <p className="mx-auto mt-3 max-w-[34ch] text-body-sm leading-relaxed text-[var(--mute)]">
            CivicCircle is intended for adults aged 18 and over. By continuing, you confirm you are 18 or older.
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col gap-2.5">
            <button type="button" onClick={confirmAge} className="btn btn-primary btn-lg w-full">
              Yes, I am 18 or older
            </button>
            <button type="button" onClick={() => router.replace("/")} className="btn btn-secondary btn-lg w-full">
              No, take me back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-4 pb-6 sm:px-6">
          <div className="mx-auto mt-4 w-full max-w-xl">
            <p className="dateline">
              <span className="dateline-mark" aria-hidden="true" />
              Welcome to your mohalla
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.9rem,5vw,2.6rem)] leading-[1.05] text-[var(--ink)]">{stepTitle}</h1>
            <p className="mt-1.5 text-body-sm text-[var(--mute)]">
              {step === 1
                ? "Pick an approximate area so you can see what's happening nearby."
                : step === 2
                  ? "This is your secret identity on CivicCircle. No real name needed."
                  : "You're all set. Jump into your mohalla and start the conversation."}
            </p>
          </div>

          <div className="mx-auto mt-5 w-full max-w-xl" aria-label="Setup progress">
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className={`h-[3px] flex-1 ${step >= n ? "bg-[var(--accent-ember)]" : "bg-[var(--hairline)]"}`} />
              ))}
            </div>
            <p className="mt-2 text-[12px] text-[var(--ash)]">Step {step} of 3</p>
          </div>

          <div className="mx-auto mt-6 w-full max-w-xl">
            {step === 1 ? (
              <div className="card space-y-3 p-4">
                {areaLabel ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-elevated)] p-3 text-[13px] text-[var(--body-text)]">
                    <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-[var(--accent-ember)]" strokeWidth={2} /> Area set: {areaLabel}</span>
                  </div>
                ) : null}

                {!showPicker ? (
                  <>
                    <button type="button" className="btn btn-primary btn-lg w-full" disabled={busy} onClick={() => void locateFromGeolocation()}>
                      <MapPin className="h-4 w-4" strokeWidth={1.8} />
                      {busy ? "Setting area..." : "Use my area"}
                    </button>
                    <button type="button" className="btn btn-secondary btn-lg w-full" disabled={busy} onClick={() => setShowPicker(true)}>
                      Choose manually
                    </button>
                    <button type="button" className="btn btn-tertiary w-full" onClick={() => setStep(2)}>
                      Skip for now
                    </button>
                  </>
                ) : (
                  <AreaPicker
                    onCancel={() => setShowPicker(false)}
                    onPick={async (result) => {
                      setBusy(true);
                      setError(null);
                      try {
                        await resolveFromCoords(result.lat, result.lng, result.city);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Could not set your area.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                )}

                {error ? <p className="text-[13px] text-[var(--accent-red)]" role="alert">{error}</p> : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="card p-5 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink)]">
                  <Sparkles className="h-7 w-7" strokeWidth={1.7} />
                </div>

                {!revealed ? (
                  <>
                    <p className="text-[15px] font-medium text-[var(--ink)]">Ready for your secret identity?</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--mute)]">
                      We will give you a ghost name. No real name, no phone, no email.
                    </p>
                    <button type="button" className="btn btn-primary btn-lg mt-6 w-full" onClick={revealGhost}>
                      Reveal my ghost name
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[12px] font-medium text-[var(--ash)]">Your ghost name</p>
                    <p className="mt-3 animate-[fadeIn_400ms_ease-out] font-display text-[clamp(2rem,6vw,2.8rem)] leading-none text-[var(--ink)]">
                      {ghostName}
                    </p>
                    <p className="mt-3 text-[13px] leading-relaxed text-[var(--mute)]">
                      This is how you show up around your mohalla. Keep it mysterious.
                    </p>
                    <button type="button" className="btn btn-primary btn-lg mt-6 w-full" onClick={() => setStep(3)}>
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </>
                )}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="card p-5 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] text-[var(--accent-ember)]">
                  <Check className="h-7 w-7" strokeWidth={2} />
                </div>
                <p className="text-[15px] font-medium text-[var(--ink)]">Your mohalla is waiting</p>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--mute)]">
                  Say hi in area chat, check nearby shops, or browse what people are posting.
                </p>
                {ghostName ? (
                  <p className="mt-3 inline-flex rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-1.5 text-[12px] text-[var(--body-text)]">
                    Posting as <span className="ml-1 font-medium text-[var(--ink)]">{ghostName}</span>
                  </p>
                ) : null}
                <button type="button" className="btn btn-primary btn-lg mt-6 w-full" onClick={finish}>
                  <span>Start talking</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            ) : null}
          </div>

          <div className="mx-auto mt-auto w-full max-w-xl pt-6 text-center">
            <div className="inline-flex items-center justify-center gap-1.5 text-[11px] tracking-[0.3px] text-[var(--mute)]">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--ash)]" strokeWidth={1.8} />
              <span>No account needed. No real name, no phone, no email.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
