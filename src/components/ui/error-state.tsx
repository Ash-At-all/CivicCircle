"use client";

import React from "react";

interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="app-tile mb-4 h-12 w-12 border-[rgba(217,106,96,0.28)] bg-[var(--accent-red-soft)] text-[var(--accent-red)]">
        <span className="text-sm font-semibold">!</span>
      </div>
      <h2 className="text-h3">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-sm text-body-sm text-[var(--mute)]">{description}</p>
      )}
      {onRetry && (
        <button onClick={onRetry} className="btn btn-primary mt-6">
          Try again
        </button>
      )}
    </div>
  );
}
