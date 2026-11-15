"use client";

import React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      {icon && (
        <div className="app-tile mb-4 h-12 w-12 text-[var(--mute)]">
          {icon}
        </div>
      )}
      <h2 className="text-h3">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-sm text-body-sm text-[var(--mute)]">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
