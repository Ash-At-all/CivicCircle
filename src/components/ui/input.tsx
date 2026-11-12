"use client";

import * as React from "react";

const baseInputClass = "w-full rounded-md border border-input bg-input-background px-3.5 py-2.5 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...restProps }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="text-xs font-medium text-muted">{label}</label>
      )}
      <input
        className={[baseInputClass, className].filter(Boolean).join(" ")}
        {...restProps}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
