"use client";

type Props = {
  onUseLocation: () => Promise<void> | void;
  onChooseManually: () => void;
  busy?: boolean;
  error?: string | null;
};

export function AreaConsent({ onUseLocation, onChooseManually, busy, error }: Props) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-lg font-semibold text-[var(--text)]">Set your area</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        We use your approximate area to show nearby shops and a local room. Your exact
        location is converted to an area cell on your device and is not stored.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
        <li>No exact coordinates saved</li>
        <li>No location history</li>
        <li>You can change or clear your area anytime</li>
      </ul>
      {error ? (
        <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="rounded-lg bg-[var(--yellow)] px-4 py-2 text-sm font-semibold text-[var(--charcoal)] disabled:opacity-60"
          onClick={() => void onUseLocation()}
          disabled={busy}
        >
          {busy ? "Setting area..." : "Use my area"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-60"
          onClick={onChooseManually}
          disabled={busy}
        >
          Choose area manually
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
    <label className="mt-4 flex items-start gap-3 text-sm text-[var(--text)]">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-[var(--yellow)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        Show me as active nearby
        <span className="block text-[var(--text-muted)]">
          Off by default. We only share that someone is active in this area, not your
          exact location.
        </span>
      </span>
    </label>
  );
}
