import * as React from "react";

type DefaultAvatarProps = {
  name?: string | null;
  seed?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  title?: string;
};

const SIZE_CLASSES: Record<NonNullable<DefaultAvatarProps["size"]>, string> = {
  xs: "h-6 w-6 text-[12px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-12 w-12 text-[15px]",
  xl: "h-16 w-16 text-[18px]",
};

function getInitial(name?: string | null) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const first = Array.from(trimmed)[0];
  return (first || "?").toUpperCase();
}

export function DefaultAvatar({
  name,
  size = "md",
  className = "",
  title,
}: DefaultAvatarProps) {
  const label = (name ?? "").trim() || "Anonymous";
  const initial = getInitial(label);

  return (
    <span
      aria-hidden="true"
      title={title ?? label}
      className={[
        "inline-flex flex-none select-none items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--surface-card)] font-medium text-[var(--ink)]",
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {initial}
    </span>
  );
}
