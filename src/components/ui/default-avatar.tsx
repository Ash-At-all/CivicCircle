import * as React from "react";

type DefaultAvatarProps = {
  name?: string | null;
  seed?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  title?: string;
};

const SIZE_CLASSES: Record<NonNullable<DefaultAvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-12 w-12 text-[15px]",
  xl: "h-16 w-16 text-[18px]",
};

const PALETTES = [
  "from-[var(--accent-blue-soft)] to-[var(--accent-green-soft)] text-white",
  "from-[var(--accent-yellow-soft)] to-[var(--accent-red-soft)] text-white",
  "from-[var(--accent-green-soft)] to-[var(--accent-blue-soft)] text-white",
  "from-[var(--accent-red-soft)] to-[var(--accent-yellow-soft)] text-white",
  "from-[var(--accent-blue-soft)] to-[var(--accent-yellow-soft)] text-white",
  "from-[var(--accent-green-soft)] to-[var(--accent-yellow-soft)] text-white",
] as const;

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitial(name?: string | null) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const first = Array.from(trimmed)[0];
  return (first || "?").toUpperCase();
}

export function DefaultAvatar({
  name,
  seed,
  size = "md",
  className = "",
  title,
}: DefaultAvatarProps) {
  const label = (name ?? "").trim() || "Anonymous";
  const key = (seed ?? label).trim() || label;
  const palette = PALETTES[hashString(key) % PALETTES.length];
  const initial = getInitial(label);

  return (
    <span
      aria-hidden="true"
      title={title ?? label}
      className={[
        "inline-flex flex-none select-none items-center justify-center rounded-full border border-white/12 bg-gradient-to-br font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/10",
        SIZE_CLASSES[size],
        palette,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {initial}
    </span>
  );
}
