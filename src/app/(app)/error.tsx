"use client";

import React from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mobile-container items-center justify-center px-4 py-16">
      <div className="card w-full max-w-md p-6 text-center">
        <span className="app-tile mx-auto mb-4 h-12 w-12 border-[rgba(217,106,96,0.28)] bg-[var(--accent-red-soft)] text-[var(--accent-red)]">
          <span className="text-sm font-semibold">!</span>
        </span>
        <h2 className="text-h3">Something went wrong</h2>
        <p className="mt-1.5 text-[13px] text-[var(--mute)]">{error.message}</p>
        <button onClick={reset} className="btn btn-primary mt-6">
          Try again
        </button>
      </div>
    </div>
  );
}
