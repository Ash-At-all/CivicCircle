"use client";

type Props = {
  onUseLocation: () => Promise<void> | void;
  onChooseManually: () => void;
  busy?: boolean;
  error?: string | null;
};

export function AreaConsent({ onUseLocation, onChooseManually, busy, error }: Props) {
  return (
    <section className="card p-5">
      <h2 className="text-h3">Set your area</h2>
      <p className="mt-2 text-body-sm text-[var(--mute)]">
        We use your approximate area to show nearby shops and a local room. Your exact
        location is converted to an area cell on your device and is not stored.
      </p>
      <ul className="mt-3 space-y-1.5 pl-0 text-body-sm text-[var(--mute)]">
        {["No exact coordinates saved", "No location history", "You can change or clear your area anytime"].map(
          (item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[var(--stone)]" />
              <span>{item}</span>
            </li>
          ),
        )}
      </ul>
      {error ? (
        <p className="mt-3 text-[13px] text-[var(--accent-red)]" role="alert">{error}</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void onUseLocation()}
          disabled={busy}
        >
          {busy ? "Setting area..." : "Use my area"}
        </button>
        <button
          type="button"
          className="btn btn-tertiary"
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
