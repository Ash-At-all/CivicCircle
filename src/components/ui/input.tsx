"use client";

import * as React from "react";

const baseInputClass =
  "field";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...restProps }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-label ml-0.5 block">{label}</label>
      )}
      <input
        className={[baseInputClass, error ? "border-[var(--accent-red)]" : "", className]
          .filter(Boolean)
          .join(" ")}
        {...restProps}
      />
      {error && (
        <p className="text-xs text-[var(--accent-red)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
