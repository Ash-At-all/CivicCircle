"use client";

import React from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mobile-container min-h-[100dvh] bg-[#171921] text-[#F2F0FA] flex flex-col items-center justify-center p-4">
      <h2 className="text-white font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-[#8B8FA3]">{error.message}</p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center rounded-button px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple to-[#9B5CF6] shadow-lg"
      >
        Try again
      </button>
    </div>
  );
}
