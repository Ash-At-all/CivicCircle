"use client";

import React from "react";

interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mb-4">
        <span className="text-red-400">!</span>
      </div>
      <h2 className="text-white font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted">{description}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-6 inline-flex items-center rounded-button px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple to-[#9B5CF6] shadow-lg hover:opacity-95"
        >
          Try again
        </button>
      )}
    </div>
  );
}
