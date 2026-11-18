"use client";

type Props = {
  onUseLocation: () => Promise<void> | void;
  onChooseManually: () => void;
  busy?: boolean;
  error?: string | null;
};

export function AreaConsent({ onUseLocation, onChooseManually, busy, error }: Props) {
  return (
    <section className="rounded-[24px] border border-white/12 bg-white/8 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-2xl backdrop-saturate-150 sm:p-6">
      <h2 className="text-[18px] font-semibold tracking-[0.1px] text-[var(--ink)]">Set your area</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-white/75">
        Approximate area only. Exact location isn&apos;t stored.
      </p>
      <ul className="mt-4 space-y-2 pl-0 text-[13px] text-white/85">
        {["No exact coordinates saved", "No location history", "Change or clear anytime"].map(
          (item) => (
            <li key={item} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/6 px-3 py-2 backdrop-blur-xl">
              <span className="h-2 w-2 flex-none rounded-full bg-[var(--accent-green)]" />
              <span>{item}</span>
            </li>
          ),
        )}
      </ul>
      {error ? (
        <p className="mt-3 text-[13px] text-[var(--accent-red)]" role="alert">{error}</p>
      ) : null}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn btn-primary btn-lg w-full rounded-full sm:w-auto"
          onClick={() => void onUseLocation()}
          disabled={busy}
        >
          {busy ? "Setting area..." : "Use my area"}
        </button>
        <button
          type="button"
          className="btn btn-tertiary btn-lg w-full rounded-full border-white/15 bg-white/8 text-white hover:bg-white/12 sm:w-auto"
          onClick={onChooseManually}
          disabled={busy}
        >
          Choose manually
        </button>
      </div>
    </section>
  );
}

export function PresenceOptIn({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 text-[13px] text-[var(--body-text)]">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        Show me as active nearby
        <span className="mt-0.5 block text-[11px] leading-relaxed tracking-[0.2px] text-[var(--mute)]">
          Off by default. We only share that someone is active in this area, not your
          exact location.
        </span>
      </span>
    </label>
  );
}
