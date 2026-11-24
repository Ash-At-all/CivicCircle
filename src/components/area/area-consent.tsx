"use client";

type Props = {
  onUseLocation: () => Promise<void> | void;
  onChooseManually: () => void;
  busy?: boolean;
  error?: string | null;
};

export function AreaConsent({ onUseLocation, onChooseManually, busy, error }: Props) {
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--hairline)] bg-[var(--surface)] p-5 sm:p-6">
      <h2 className="font-display text-[24px] leading-tight text-[var(--ink)]">Set your area</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--body-text)]">
        Approximate area only. Exact location isn&apos;t stored.
      </p>
      <ul className="mt-4 space-y-1.5 pl-0 text-[13px] text-[var(--body-text)]">
        {["No exact coordinates saved", "No location history", "Change or clear anytime"].map(
          (item) => (
            <li
              key={item}
              className="flex items-center gap-2.5 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-2"
            >
              <span
                className="h-1.5 w-1.5 flex-none bg-[var(--accent-ember)]"
                aria-hidden="true"
              />
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
          className="btn btn-primary btn-lg w-full sm:w-auto"
          onClick={() => void onUseLocation()}
          disabled={busy}
        >
          {busy ? "Setting area..." : "Use my area"}
        </button>
        <button
          type="button"
          className="btn btn-tertiary btn-lg w-full sm:w-auto"
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
        <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--mute)]">
          Off by default. We only share that someone is active in this area, not your
          exact location.
        </span>
      </span>
    </label>
  );
}
