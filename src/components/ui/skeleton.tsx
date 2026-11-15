"use client";

import * as React from "react";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`animate-[skeleton-pulse_1.6s_ease-in-out_infinite] rounded-[var(--radius-md)] border border-[var(--hairline)] bg-[var(--surface-card)] ${
        className ?? ""
      }`}
    />
  );
}
